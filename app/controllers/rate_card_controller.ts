import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import LabTestCatalog from '#models/lab_test_catalog'
import Medication from '#models/medication'
import RateCardService from '#models/rate_card_service'
import RateCardPricingService from '#services/billing/rate_card_pricing_service'

const VISIT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Admission', 'Appointment', 'Other']

const ACTIVITY_TYPES = ['consultation', 'lab_test', 'medication', 'treatment_room'] as const
const CATEGORIES = ['hospital', 'pharmacy', 'excluded', 'outsourced'] as const

export default class RateCardController {
  private readonly pricing = new RateCardPricingService()

  async index({ request, inertia }: HttpContext) {
    const qs = request.qs()
    const search = qs.search ? String(qs.search).trim() : ''
    const activityType = qs.activity_type ? String(qs.activity_type) : ''
    const category = qs.category ? String(qs.category) : ''
    const status = qs.status ? String(qs.status) : ''
    const page = Math.max(1, Number(qs.page ?? 1))

    const services = await RateCardService.query()
      .preload('labTestCatalog')
      .preload('medication')
      .if(search !== '', (q) =>
        q.where((sub) => {
          sub
            .whereILike('name', `%${search}%`)
            .orWhereILike('code', `%${search}%`)
            .orWhereILike('activityKey', `%${search}%`)
        })
      )
      .if(activityType !== '' && ACTIVITY_TYPES.includes(activityType as (typeof ACTIVITY_TYPES)[number]), (q) =>
        q.where('activityType', activityType)
      )
      .if(category !== '' && CATEGORIES.includes(category as (typeof CATEGORIES)[number]), (q) =>
        q.where('category', category)
      )
      .if(status === 'active', (q) => q.where('isActive', true))
      .if(status === 'inactive', (q) => q.where('isActive', false))
      .orderBy('activityType')
      .orderBy('name')
      .paginate(page, 50)

    const counts = await db
      .from('rate_card_services')
      .select('activity_type')
      .count('* as total')
      .groupBy('activity_type')

    const countByType: Record<string, number> = {}
    for (const row of counts) {
      countByType[row.activity_type as string] = Number(row.total)
    }

    return inertia.render('rate-card/index', {
      services: {
        data: services.all().map((s) => this.serialize(s)),
        meta: services.getMeta(),
      },
      filters: { search, activityType, category, status },
      activityTypes: ACTIVITY_TYPES,
      categories: CATEGORIES,
      visitTypes: VISIT_TYPES,
      counts: countByType,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const service = await RateCardService.findOrFail(params.service)
    const data = await this.validateUpdate(request)

    service.merge({
      name: data.name,
      price: data.price,
      category: data.category,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : service.isActive,
    })
    await service.save()
    this.pricing.clearCache()

    session.flash('success', 'Rate card service updated.')
    return response.redirect().back()
  }

  async sync({ response, session }: HttpContext) {
    const now = new Date()

    for (const visitType of VISIT_TYPES) {
      await this.upsertFromCatalog({
        code: `CONSULT_${visitType.replace(/\s+/g, '_').toUpperCase()}`,
        name: `${visitType} Consultation`,
        category: 'hospital',
        activityType: 'consultation',
        activityKey: visitType,
        price: 150,
        isActive: true,
        now,
      })
    }

    const labTests = await LabTestCatalog.query().where('isActive', true).orderBy('name')
    for (const test of labTests) {
      const code = test.code ?? `LAB_${test.name.replace(/\s+/g, '_').toUpperCase()}`
      await this.upsertFromCatalog({
        code: code.slice(0, 80),
        name: test.name,
        category: 'hospital',
        activityType: 'lab_test',
        activityKey: test.name,
        labTestCatalogId: test.id,
        price: 120,
        isActive: true,
        now,
      })
    }

    const medications = await Medication.query().where('isActive', true).orderBy('name')
    for (const medication of medications) {
      const code = `PHARM_${medication.name.replace(/\s+/g, '_').toUpperCase()}`.slice(0, 72) + `_${medication.id}`
      await this.upsertFromCatalog({
        code,
        name: medication.name,
        category: 'pharmacy',
        activityType: 'medication',
        activityKey: medication.name,
        medicationId: medication.id,
        price: 35,
        isActive: true,
        now,
      })
    }

    await this.upsertFromCatalog({
      code: 'TREATMENT_ROOM_DEFAULT',
      name: 'Treatment Room Services',
      category: 'hospital',
      activityType: 'treatment_room',
      activityKey: 'default',
      price: 100,
      isActive: true,
      now,
    })

    this.pricing.clearCache()
    session.flash('success', 'Rate card synced from system activities.')
    return response.redirect().toPath('/rate-card')
  }

  private serialize(service: RateCardService) {
    return {
      id: service.id,
      code: service.code,
      name: service.name,
      category: service.category,
      activityType: service.activityType,
      activityKey: service.activityKey,
      labTestCatalogId: service.labTestCatalogId,
      medicationId: service.medicationId,
      linkedActivity:
        service.activityType === 'consultation'
          ? `Visit: ${service.activityKey}`
          : service.activityType === 'lab_test'
            ? service.labTestCatalog?.name ?? service.activityKey
            : service.activityType === 'medication'
              ? service.medication?.name ?? service.activityKey
              : 'Treatment room',
      price: Number(service.price),
      isActive: service.isActive,
    }
  }

  private async validateUpdate(request: HttpContext['request']) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(255),
        price: vine.number().min(0),
        category: vine.enum(CATEGORIES),
        is_active: vine.any().optional(),
      })
    )
    return request.validateUsing(validator)
  }

  private async upsertFromCatalog(data: {
    code: string
    name: string
    category: string
    activityType: string
    activityKey: string
    labTestCatalogId?: number
    medicationId?: number
    price: number
    isActive: boolean
    now: Date
  }) {
    let existing: RateCardService | null = null

    if (data.labTestCatalogId) {
      existing = await RateCardService.query().where('labTestCatalogId', data.labTestCatalogId).first()
    } else if (data.medicationId) {
      existing = await RateCardService.query().where('medicationId', data.medicationId).first()
    } else if (data.activityType === 'consultation') {
      existing = await RateCardService.query()
        .where('activityType', 'consultation')
        .where('activityKey', data.activityKey)
        .first()
    } else if (data.activityType === 'treatment_room') {
      existing = await RateCardService.query().where('activityType', 'treatment_room').first()
    }

    existing ??= await RateCardService.query().where('code', data.code).first()

    if (existing) {
      existing.merge({
        name: data.name,
        activityKey: data.activityKey,
        labTestCatalogId: data.labTestCatalogId ?? null,
        medicationId: data.medicationId ?? null,
        isActive: data.isActive,
      })
      await existing.save()
      return
    }

    await RateCardService.create({
      code: data.code,
      name: data.name,
      category: data.category as RateCardService['category'],
      activityType: data.activityType as RateCardService['activityType'],
      activityKey: data.activityKey,
      labTestCatalogId: data.labTestCatalogId ?? null,
      medicationId: data.medicationId ?? null,
      price: data.price,
      isActive: data.isActive,
    })
  }
}
