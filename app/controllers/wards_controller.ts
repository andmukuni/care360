import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Ward from '#models/ward'

/**
 * Wards CRUD. Ported from App\Http\Controllers\WardController.
 *
 * Index/show now expose occupancy summaries so the board UI can manage beds
 * (including discharge) from the ward context.
 */
const WINGS = ['Male', 'Female', 'Paediatric'] as const
const TYPES = [
  'General',
  'ICU',
  'Maternity',
  'Paediatric',
  'Surgical',
  'Medical',
  'Isolation',
  'Emergency',
] as const

export default class WardsController {
  async index({ request, inertia }: HttpContext) {
    const qs = request.qs()
    const wing = qs.wing ? String(qs.wing) : null
    const search = String(qs.q ?? '').trim()
    const activeOnly = String(qs.active ?? 'all')

    const wards = await Ward.query()
      .preload('beds', (q) => q.orderBy('bedNumber'))
      .if(wing, (q) => q.where('wing', wing!))
      .if(search !== '', (q) =>
        q.where((sub) => {
          sub
            .whereILike('name', `%${search}%`)
            .orWhereILike('location', `%${search}%`)
            .orWhereILike('type', `%${search}%`)
        })
      )
      .if(activeOnly === 'active', (q) => q.where('isActive', true))
      .if(activeOnly === 'inactive', (q) => q.where('isActive', false))
      .orderBy('wing')
      .orderBy('name')

    const mapped = wards.map((w) => {
      const beds = w.beds ?? []
      const count = (status: string) => beds.filter((b) => b.status === status).length
      return {
        id: w.id,
        name: w.name,
        wing: w.wing,
        type: w.type,
        location: w.location,
        notes: w.notes,
        bedsCount: beds.length,
        availableBedsCount: count('available'),
        occupiedBedsCount: count('occupied'),
        reservedBedsCount: count('reserved'),
        maintenanceBedsCount: count('maintenance'),
        isActive: w.isActive,
      }
    })

    const totals = mapped.reduce(
      (acc, ward) => {
        acc.wards += 1
        acc.beds += ward.bedsCount
        acc.available += ward.availableBedsCount
        acc.occupied += ward.occupiedBedsCount
        acc.reserved += ward.reservedBedsCount
        acc.maintenance += ward.maintenanceBedsCount
        return acc
      },
      { wards: 0, beds: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0 }
    )

    return inertia.render('wards/index', {
      wards: mapped,
      wings: WINGS,
      filters: { wing, search, active: activeOnly },
      totals,
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('wards/create', { wings: WINGS, types: TYPES })
  }

  async store({ request, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(100),
        type: vine.enum(TYPES),
        wing: vine.enum(WINGS),
        location: vine.string().trim().maxLength(200).nullable().optional(),
        notes: vine.string().trim().maxLength(1000).nullable().optional(),
        is_active: vine.any().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const duplicate = await Ward.query().where('name', data.name).first()
    if (duplicate) {
      session.flashErrors({ name: 'A ward with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    await Ward.create({
      name: data.name,
      type: data.type,
      wing: data.wing,
      location: data.location ?? null,
      notes: data.notes ?? null,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : true,
    })

    session.flash('success', 'Ward created successfully.')
    return response.redirect().toPath('/wards')
  }

  async show({ params, inertia }: HttpContext) {
    const ward = await Ward.findOrFail(params.ward)
    await ward.load('beds', (q) => q.orderBy('bedNumber'))

    const beds = ward.beds
    const count = (status: string) => beds.filter((b) => b.status === status).length

    return inertia.render('wards/show', {
      ward: {
        id: ward.id,
        name: ward.name,
        type: ward.type,
        wing: ward.wing,
        location: ward.location,
        notes: ward.notes,
        isActive: ward.isActive,
        bedsCount: beds.length,
        availableBedsCount: count('available'),
        occupiedBedsCount: count('occupied'),
        reservedBedsCount: count('reserved'),
        maintenanceBedsCount: count('maintenance'),
      },
      beds: beds.map((b) => ({
        id: b.id,
        bedNumber: b.bedNumber,
        status: b.status,
        patientName: b.patientName,
        admittedAt: b.admittedAt ? b.admittedAt.toFormat('dd LLL yyyy HH:mm') : null,
        isActive: b.isActive,
      })),
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const ward = await Ward.findOrFail(params.ward)
    return inertia.render('wards/edit', {
      ward: {
        id: ward.id,
        name: ward.name,
        type: ward.type,
        wing: ward.wing,
        location: ward.location,
        notes: ward.notes,
        isActive: ward.isActive,
      },
      wings: WINGS,
      types: TYPES,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const ward = await Ward.findOrFail(params.ward)
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(100),
        type: vine.enum(TYPES),
        wing: vine.enum(WINGS),
        location: vine.string().trim().maxLength(200).nullable().optional(),
        notes: vine.string().trim().maxLength(1000).nullable().optional(),
        is_active: vine.any().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const duplicate = await Ward.query().where('name', data.name).whereNot('id', ward.id).first()
    if (duplicate) {
      session.flashErrors({ name: 'A ward with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    ward.merge({
      name: data.name,
      type: data.type,
      wing: data.wing,
      location: data.location ?? null,
      notes: data.notes ?? null,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : false,
    })
    await ward.save()

    session.flash('success', 'Ward updated successfully.')
    return response.redirect().toPath(`/wards/${ward.id}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const ward = await Ward.findOrFail(params.ward)
    await ward.delete()

    session.flash('success', 'Ward deleted.')
    return response.redirect().toPath('/wards')
  }

  /**
   * GET /wards/beds — active wards with their active beds (screening admit modal).
   */
  async bedsData({ response }: HttpContext) {
    const wards = await Ward.query()
      .where('isActive', true)
      .preload('beds', (q) => q.where('isActive', true).orderBy('bedNumber'))
      .orderBy('wing')
      .orderBy('name')

    return response.json(
      wards.map((w) => ({
        id: w.id,
        name: w.name,
        wing: w.wing,
        beds: w.beds.map((b) => ({
          id: b.id,
          bed_number: b.bedNumber,
          status: b.status,
          patient_name: b.patientName,
          admitted_at: b.admittedAt ? b.admittedAt.toFormat('dd LLL yyyy HH:mm') : null,
        })),
      }))
    )
  }
}
