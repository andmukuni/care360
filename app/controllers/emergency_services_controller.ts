import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import EmergencyContactLog from '#models/emergency_contact_log'
import EmergencyService from '#models/emergency_service'

/**
 * Emergency service directory management (patient portal / app).
 * Ported from App\Http\Controllers\EmergencyServiceController.
 */
const CATEGORIES: Record<string, string> = {
  ambulance: 'Ambulance',
  emergency_line: 'Emergency line',
  trauma: 'Trauma & casualty',
  maternity: 'Maternity emergency',
  poison: 'Poison control',
  security: 'Hospital security',
  other: 'Other',
}
const CATEGORY_KEYS = Object.keys(CATEGORIES) as [string, ...string[]]

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const serviceValidator = vine.compile(
  vine.object({
    name: vine.string().trim().maxLength(120),
    category: vine.enum(CATEGORY_KEYS),
    phone_number: vine.string().trim().maxLength(30),
    secondary_phone: vine.string().trim().maxLength(30).nullable().optional(),
    description: vine.string().trim().maxLength(1000).nullable().optional(),
    instructions: vine.string().trim().maxLength(2000).nullable().optional(),
    is_24_7: vine.boolean().optional(),
    is_active: vine.boolean().optional(),
    sort_order: vine.number().min(0).max(999).nullable().optional(),
  })
)

export default class EmergencyServicesController {
  async index({ inertia }: HttpContext) {
    const since = DateTime.now().minus({ days: 1 })

    const services = await EmergencyService.query()
      .withCount('emergencyContactLogs', (q) =>
        q.where('contactedAt', '>=', since.toSQL({ includeOffset: false })!).as('contacts_24h_count')
      )
      .orderBy('sortOrder')
      .orderBy('name')

    const recentContacts = await EmergencyContactLog.query()
      .preload('patient', (q) => q.select('id', 'fullName', 'patientId'))
      .preload('emergencyService', (q) => q.select('id', 'name'))
      .orderBy('contactedAt', 'desc')
      .limit(25)

    return inertia.render('emergency-services/index', {
      categories: CATEGORIES,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        categoryLabel: CATEGORIES[s.category] ?? s.category,
        phoneNumber: s.phoneNumber,
        secondaryPhone: s.secondaryPhone,
        description: s.description,
        instructions: s.instructions,
        is247: s.is247,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
        contacts24hCount: Number(s.$extras.contacts_24h_count ?? 0),
      })),
      recentContacts: recentContacts.map((c) => ({
        id: c.id,
        patientName: c.patient?.fullName ?? '—',
        patientNumber: c.patient?.patientId ?? null,
        serviceName: c.emergencyService?.name ?? '—',
        source: c.source,
        phoneDialed: c.phoneDialed,
        contactedAt: c.contactedAt ? c.contactedAt.toISO() : null,
      })),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(serviceValidator)

    const slug = slugify(data.name)
    const exists = await EmergencyService.query().where('slug', slug).first()
    if (exists) {
      session.flashErrors({ name: 'A service with a similar name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    await EmergencyService.create(this.attributes(data, slug))

    session.flash('success', `Emergency service “${data.name}” created.`)
    return response.redirect().toPath('/emergency-services')
  }

  async update({ params, request, response, session }: HttpContext) {
    const service = await EmergencyService.findOrFail(params.emergencyService)
    const data = await request.validateUsing(serviceValidator)

    const slug = slugify(data.name)
    const exists = await EmergencyService.query().where('slug', slug).whereNot('id', service.id).first()
    if (exists) {
      session.flashErrors({ name: 'A service with a similar name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    service.merge(this.attributes(data, slug))
    await service.save()

    session.flash('success', `Emergency service “${service.name}” updated.`)
    return response.redirect().toPath('/emergency-services')
  }

  async destroy({ params, response, session }: HttpContext) {
    const service = await EmergencyService.findOrFail(params.emergencyService)
    await service.delete()

    session.flash('success', 'Emergency service removed.')
    return response.redirect().toPath('/emergency-services')
  }

  private attributes(
    data: {
      name: string
      category: string
      phone_number: string
      secondary_phone?: string | null
      description?: string | null
      instructions?: string | null
      is_24_7?: boolean
      is_active?: boolean
      sort_order?: number | null
    },
    slug: string
  ): Record<string, any> {
    return {
      name: data.name,
      slug,
      category: data.category,
      phoneNumber: data.phone_number,
      secondaryPhone: data.secondary_phone ?? null,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
      is247: data.is_24_7 ?? false,
      isActive: data.is_active ?? false,
      sortOrder: Math.trunc(data.sort_order ?? 0),
    }
  }
}
