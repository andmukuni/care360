import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import Bed from '#models/bed'
import BedAssignment from '#models/bed_assignment'
import Encounter from '#models/encounter'
import Ward from '#models/ward'

/**
 * Beds CRUD + status/move/discharge actions. Ported from
 * App\Http\Controllers\BedController.
 *
 * The Laravel index rendered a ward-grouped grid; here `index` returns the full
 * ordered bed list (with ward name/wing joined) plus status counts, rendered
 * with the shared client-side DataTable. The AJAX-only `updateStatus` and `move`
 * endpoints redirect back with a flash message (Inertia-friendly) instead of
 * returning JSON. `App\Support\BedHistory::closeOpen` is inlined as a static
 * helper (the Adonis app has no equivalent support class).
 */
const STATUSES = ['available', 'occupied', 'reserved', 'maintenance'] as const
const WINGS = ['Male', 'Female', 'Paediatric'] as const

async function closeOpenAssignments(bedId: number, userId: number | null): Promise<void> {
  await BedAssignment.query()
    .where('bedId', bedId)
    .whereNull('dischargedAt')
    .update({
      discharged_at: DateTime.now().toSQL(),
      discharged_by: userId,
      updated_at: DateTime.now().toSQL(),
    })
}

async function clearEncounterWard(encounterId: number | null): Promise<void> {
  if (!encounterId) return
  await Encounter.query().where('id', encounterId).update({
    ward_id: null,
    ward_assigned_at: null,
    ward_assigned_by: null,
  })
}

export default class BedsController {
  async index({ request, inertia }: HttpContext) {
    const qs = request.qs()
    const status = String(qs.status ?? 'all')
    const wardId = qs.ward_id ? Number(qs.ward_id) : null
    const wing = qs.wing ? String(qs.wing) : null
    const search = String(qs.q ?? '').trim()

    const wards = await Ward.query()
      .where('isActive', true)
      .orderBy('wing')
      .orderBy('name')
      .select('id', 'name', 'wing')

    const wardIdsForWing = wing
      ? (await Ward.query().where('wing', wing).select('id')).map((w) => w.id)
      : null

    const baseCount = () =>
      Bed.query()
        .if(wardId, (q) => q.where('wardId', wardId!))
        .if(wardIdsForWing, (q) => q.whereIn('wardId', wardIdsForWing!))

    const countFor = async (s: string | null) => {
      const q = baseCount()
      if (s) q.where('status', s)
      const res = await q.count('* as total')
      return Number(res[0].$extras.total ?? 0)
    }

    const statusCounts = {
      all: await countFor(null),
      available: await countFor('available'),
      occupied: await countFor('occupied'),
      reserved: await countFor('reserved'),
      maintenance: await countFor('maintenance'),
    }

    const beds = await Bed.query()
      .preload('ward')
      .if(wardId, (q) => q.where('wardId', wardId!))
      .if(wardIdsForWing, (q) => q.whereIn('wardId', wardIdsForWing!))
      .if(STATUSES.includes(status as any), (q) => q.where('status', status))
      .if(search !== '', (q) =>
        q.where((sub) => {
          sub.whereILike('bedNumber', `%${search}%`).orWhereILike('patientName', `%${search}%`)
        })
      )
      .orderBy('wardId')
      .orderBy('bedNumber')

    return inertia.render('beds/index', {
      beds: beds.map((b) => ({
        id: b.id,
        bedNumber: b.bedNumber,
        wardId: b.wardId,
        wardName: b.ward?.name ?? null,
        wing: b.ward?.wing ?? null,
        status: b.status,
        patientName: b.patientName,
        admittedAt: b.admittedAt ? b.admittedAt.toFormat('dd LLL yyyy HH:mm') : null,
        isActive: b.isActive,
      })),
      wards: wards.map((w) => ({ id: w.id, name: w.name, wing: w.wing })),
      wings: WINGS,
      statuses: STATUSES,
      statusCounts,
      filters: { status, wardId, wing, search },
    })
  }

  async create({ request, inertia }: HttpContext) {
    const wards = await Ward.query().where('isActive', true).orderBy('wing').orderBy('name')
    return inertia.render('beds/create', {
      wards: wards.map((w) => ({ id: w.id, name: w.name, wing: w.wing })),
      statuses: STATUSES,
      selectedWard: request.qs().ward_id ? Number(request.qs().ward_id) : null,
    })
  }

  async store({ request, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        ward_id: vine.number(),
        bed_number: vine.string().trim().maxLength(20),
        notes: vine.string().trim().maxLength(500).nullable().optional(),
        is_active: vine.any().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const ward = await Ward.find(data.ward_id)
    if (!ward) {
      session.flashErrors({ ward_id: 'The selected ward does not exist.' })
      session.flashAll()
      return response.redirect().back()
    }

    const exists = await Bed.query()
      .where('wardId', data.ward_id)
      .where('bedNumber', data.bed_number)
      .first()
    if (exists) {
      session.flashErrors({
        bed_number: 'A bed with this number already exists in the selected ward.',
      })
      session.flashAll()
      return response.redirect().back()
    }

    await Bed.create({
      wardId: data.ward_id,
      bedNumber: data.bed_number,
      status: 'available',
      notes: data.notes ?? null,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : true,
    })

    session.flash('success', `Bed ${data.bed_number} created successfully.`)
    return response.redirect().toPath(`/beds?ward_id=${data.ward_id}`)
  }

  async show({ params, inertia }: HttpContext) {
    const bed = await Bed.query()
      .where('id', params.bed)
      .preload('ward')
      .preload('encounter', (q) => q.preload('patient'))
      .preload('bedAccessories', (q) => q.preload('accessoryType'))
      .preload('bedAssignments', (q) =>
        q
          .orderBy('admittedAt', 'desc')
          .limit(20)
          .preload('encounter')
          .preload('admittedByUser')
          .preload('dischargedByUser')
      )
      .firstOrFail()

    const wardBeds = await Bed.query().where('wardId', bed.wardId).orderBy('bedNumber')

    const allWardsWithBeds = await Ward.query()
      .where('isActive', true)
      .preload('beds', (q) => q.orderBy('bedNumber'))
      .orderBy('wing')
      .orderBy('name')

    const patientName =
      bed.encounter?.patient?.fullName ?? bed.patientName ?? null

    return inertia.render('beds/show', {
      bed: {
        id: bed.id,
        bedNumber: bed.bedNumber,
        wardId: bed.wardId,
        wardName: bed.ward?.name ?? null,
        wing: bed.ward?.wing ?? null,
        status: bed.status,
        encounterId: bed.encounterId,
        patientName,
        admittedAt: bed.admittedAt ? bed.admittedAt.toFormat('dd LLL yyyy HH:mm') : null,
        dischargedAt: bed.dischargedAt ? bed.dischargedAt.toFormat('dd LLL yyyy HH:mm') : null,
        notes: bed.notes,
        isActive: bed.isActive,
        patient: bed.encounter?.patient
          ? {
              id: bed.encounter.patient.id,
              patientId: bed.encounter.patient.patientId,
              fullName: bed.encounter.patient.fullName,
            }
          : null,
        accessories: bed.bedAccessories.map((a) => ({
          id: a.id,
          name: a.name,
          assetTag: a.assetTag,
          status: a.status,
          type: a.accessoryType?.name ?? null,
        })),
        assignments: bed.bedAssignments.map((a) => ({
          id: a.id,
          patientName: a.patientName,
          admittedAt: a.admittedAt ? a.admittedAt.toFormat('dd LLL yyyy HH:mm') : null,
          dischargedAt: a.dischargedAt ? a.dischargedAt.toFormat('dd LLL yyyy HH:mm') : null,
          admittedBy: a.admittedByUser?.name ?? null,
          dischargedBy: a.dischargedByUser?.name ?? null,
        })),
      },
      wardBeds: wardBeds.map((b) => ({
        id: b.id,
        bedNumber: b.bedNumber,
        status: b.status,
        patientName: b.patientName,
        isCurrent: b.id === bed.id,
      })),
      allWardsWithBeds: allWardsWithBeds.map((w) => ({
        id: w.id,
        name: w.name,
        wing: w.wing,
        beds: w.beds.map((b) => ({ id: b.id, bedNumber: b.bedNumber })),
      })),
      statuses: STATUSES,
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const bed = await Bed.findOrFail(params.bed)
    const wards = await Ward.query().where('isActive', true).orderBy('wing').orderBy('name')
    return inertia.render('beds/edit', {
      bed: {
        id: bed.id,
        wardId: bed.wardId,
        bedNumber: bed.bedNumber,
        status: bed.status,
        notes: bed.notes,
        isActive: bed.isActive,
      },
      wards: wards.map((w) => ({ id: w.id, name: w.name, wing: w.wing })),
      statuses: STATUSES,
    })
  }

  async update({ params, request, response, session, auth }: HttpContext) {
    const bed = await Bed.findOrFail(params.bed)
    const validator = vine.compile(
      vine.object({
        ward_id: vine.number(),
        bed_number: vine.string().trim().maxLength(20),
        status: vine.enum(STATUSES),
        notes: vine.string().trim().maxLength(500).nullable().optional(),
        is_active: vine.any().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const exists = await Bed.query()
      .where('wardId', data.ward_id)
      .where('bedNumber', data.bed_number)
      .whereNot('id', bed.id)
      .first()
    if (exists) {
      session.flashErrors({
        bed_number: 'A bed with this number already exists in the selected ward.',
      })
      session.flashAll()
      return response.redirect().back()
    }

    bed.merge({
      wardId: data.ward_id,
      bedNumber: data.bed_number,
      status: data.status,
      notes: data.notes ?? null,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : false,
    })

    if (data.status !== 'occupied') {
      const previousEncounterId = bed.encounterId
      bed.merge({
        patientName: null,
        admittedAt: null,
        encounterId: null,
        dischargedAt: DateTime.now(),
      })
      await clearEncounterWard(previousEncounterId)
      await closeOpenAssignments(bed.id, auth.user?.id ?? null)
    }

    await bed.save()

    session.flash('success', `Bed ${bed.bedNumber} updated successfully.`)
    return response.redirect().toPath(`/beds?ward_id=${bed.wardId}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const bed = await Bed.findOrFail(params.bed)
    const wardId = bed.wardId
    const number = bed.bedNumber
    await bed.delete()

    session.flash('success', `Bed ${number} deleted.`)
    return response.redirect().toPath(`/beds?ward_id=${wardId}`)
  }

  /**
   * PATCH /beds/{bed}/status — set status; frees the bed when not "occupied".
   */
  async updateStatus({ params, request, response, session, auth }: HttpContext) {
    const bed = await Bed.findOrFail(params.bed)
    const validator = vine.compile(
      vine.object({
        status: vine.enum(STATUSES),
        patient_name: vine.string().trim().maxLength(150).nullable().optional(),
        notes: vine.string().trim().maxLength(500).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const isFreeing = data.status !== 'occupied'
    const previousEncounterId = bed.encounterId

    bed.merge({
      status: data.status,
      patientName: data.status === 'occupied' ? (data.patient_name ?? null) : null,
      admittedAt: data.status === 'occupied' ? DateTime.now() : null,
      notes: data.notes ?? bed.notes,
    })

    if (isFreeing) {
      bed.merge({ encounterId: null, dischargedAt: DateTime.now() })
      await clearEncounterWard(previousEncounterId)
      await closeOpenAssignments(bed.id, auth.user?.id ?? null)
    }

    await bed.save()

    session.flash('success', `Bed ${bed.bedNumber} status updated to ${bed.status}.`)
    return response.redirect().back()
  }

  /**
   * PATCH /beds/{bed}/move — move a bed to a different ward (optionally renaming).
   */
  async move({ params, request, response, session }: HttpContext) {
    const bed = await Bed.findOrFail(params.bed)
    const validator = vine.compile(
      vine.object({
        ward_id: vine.number(),
        bed_number: vine.string().trim().maxLength(20).nullable().optional(),
        reason: vine.string().trim().maxLength(500).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    if (data.ward_id === bed.wardId) {
      session.flashErrors({ ward_id: 'The bed is already in this ward.' })
      session.flashAll()
      return response.redirect().back()
    }

    const newNumber = data.bed_number ?? bed.bedNumber

    const duplicate = await Bed.query()
      .where('wardId', data.ward_id)
      .where('bedNumber', newNumber)
      .whereNot('id', bed.id)
      .first()
    if (duplicate) {
      session.flashErrors({
        bed_number: `A bed numbered "${newNumber}" already exists in the target ward. Please rename the bed during the move.`,
      })
      session.flashAll()
      return response.redirect().back()
    }

    const oldWard = await Ward.find(bed.wardId)
    const newWard = await Ward.find(data.ward_id)

    const movementNote = `[${DateTime.now().toFormat('dd LLL yyyy HH:mm')}] Moved from ${
      oldWard?.name ?? '—'
    } to ${newWard?.name ?? '—'}${data.reason ? ` — Reason: ${data.reason}` : ''}`
    const combinedNotes = `${bed.notes ? bed.notes + '\n' : ''}${movementNote}`.trim()

    bed.merge({ wardId: data.ward_id, bedNumber: newNumber, notes: combinedNotes })
    await bed.save()

    session.flash(
      'success',
      `Bed ${newNumber} moved from ${oldWard?.name ?? '—'} to ${newWard?.name ?? '—'}.`
    )
    return response.redirect().back()
  }

  /**
   * POST /beds/{bed}/discharge — free an occupied bed and close its assignment.
   */
  async discharge({ params, response, session, auth }: HttpContext) {
    const bed = await Bed.findOrFail(params.bed)

    if (bed.status !== 'occupied') {
      session.flashErrors({ discharge: 'Bed is not currently occupied.' })
      session.flashAll()
      return response.redirect().back()
    }

    const previousEncounterId = bed.encounterId

    bed.merge({
      status: 'available',
      encounterId: null,
      patientName: null,
      admittedAt: null,
      dischargedAt: DateTime.now(),
    })
    await bed.save()
    await clearEncounterWard(previousEncounterId)
    await closeOpenAssignments(bed.id, auth.user?.id ?? null)

    session.flash('success', `Bed ${bed.bedNumber} discharged successfully.`)
    return response.redirect().back()
  }
}
