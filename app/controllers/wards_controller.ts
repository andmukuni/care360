import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Ward from '#models/ward'

/**
 * Wards CRUD. Ported from App\Http\Controllers\WardController.
 *
 * The Laravel version served its list through a jQuery DataTables JSON endpoint
 * (`datatable`); here `index` returns the full ordered row set and the Inertia
 * page renders it with the shared client-side DataTable. `bedsData` is kept as a
 * JSON endpoint (consumed by the screening admit modal).
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
  async index({ inertia }: HttpContext) {
    const wards = await Ward.query().withCount('beds').orderBy('wing').orderBy('name')

    return inertia.render('wards/index', {
      wards: wards.map((w) => ({
        id: w.id,
        name: w.name,
        wing: w.wing,
        type: w.type,
        location: w.location,
        bedsCount: Number(w.$extras.beds_count ?? 0),
        isActive: w.isActive,
      })),
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
    return response.redirect().toPath('/wards')
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
