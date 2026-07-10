import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import AccessoryType from '#models/accessory_type'
import Bed from '#models/bed'
import BedAccessory from '#models/bed_accessory'
import BedAccessoryMove from '#models/bed_accessory_move'
import Ward from '#models/ward'

/**
 * Bed accessory inventory. Ported from App\Http\Controllers\BedAccessoryController.
 *
 * The Laravel `BedAccessory::moveTo()` model method (updates bed_id + writes an
 * audit `bed_accessory_moves` row) is inlined here as `moveAccessory`, since the
 * Adonis model exposes neither `moveTo` nor the `display_label` accessor.
 */
const STATUSES = ['active', 'maintenance', 'retired'] as const

function displayLabel(accessory: BedAccessory): string {
  const base = accessory.name || accessory.accessoryType?.name || 'Accessory'
  return accessory.assetTag ? `${base} (${accessory.assetTag})` : base
}

/**
 * Move an accessory to a bed (or to storage when bedId is null), writing an
 * audit row. No-op when the destination equals the current bed.
 */
async function moveAccessory(
  accessory: BedAccessory,
  bedId: number | null,
  userId: number | null,
  reason: string | null
): Promise<void> {
  const current = accessory.bedId
  const sameDestination =
    (current === null && bedId === null) ||
    (current !== null && bedId !== null && current === bedId)
  if (sameDestination) return

  let fromBedId = current
  if (fromBedId !== null) {
    const stillExists = await Bed.find(fromBedId)
    if (!stillExists) fromBedId = null
  }

  accessory.bedId = bedId
  await accessory.save()

  await BedAccessoryMove.create({
    bedAccessoryId: accessory.id,
    fromBedId,
    toBedId: bedId,
    movedBy: userId,
    movedAt: DateTime.now(),
    reason,
  })
}

export default class AccessoriesController {
  async index({ request, inertia }: HttpContext) {
    const qs = request.qs()
    const typeId = qs.type_id ? Number(qs.type_id) : null
    const status = qs.status ? String(qs.status) : null
    const location = qs.location ? String(qs.location) : null

    const accessories = await BedAccessory.query()
      .preload('accessoryType')
      .preload('bed', (q) => q.preload('ward'))
      .if(typeId, (q) => q.where('accessoryTypeId', typeId!))
      .if(status, (q) => q.where('status', status!))
      .if(location === 'in_storage', (q) => q.whereNull('bedId'))
      .if(location === 'on_bed', (q) => q.whereNotNull('bedId'))
      .if(location === 'maintenance', (q) => q.where('status', 'maintenance'))
      .orderBy('accessoryTypeId')
      .orderBy('assetTag')

    const types = await AccessoryType.query().where('isActive', true).orderBy('name')

    return inertia.render('accessories/index', {
      accessories: accessories.map((a) => ({
        id: a.id,
        label: displayLabel(a),
        name: a.name,
        assetTag: a.assetTag,
        type: a.accessoryType?.name ?? null,
        status: a.status,
        bedId: a.bedId,
        bedNumber: a.bed?.bedNumber ?? null,
        wardName: a.bed?.ward?.name ?? null,
        location: a.bedId ? 'On bed' : 'In storage',
      })),
      types: types.map((t) => ({ id: t.id, name: t.name })),
      statuses: STATUSES,
      filters: { typeId, status, location },
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('accessories/create', {
      accessory: { status: 'active' },
      ...(await this.formOptions()),
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const data = await this.validateForm(request)

    if (data.asset_tag) {
      const dup = await BedAccessory.query().where('assetTag', data.asset_tag).first()
      if (dup) {
        session.flashErrors({ asset_tag: 'This asset tag is already in use.' })
        session.flashAll()
        return response.redirect().back()
      }
    }

    const accessory = await BedAccessory.create({
      accessoryTypeId: data.accessory_type_id,
      assetTag: data.asset_tag ?? null,
      name: data.name ?? null,
      bedId: data.bed_id ?? null,
      status: data.status ?? 'active',
      notes: data.notes ?? null,
    })

    if (accessory.bedId) {
      const bed = await Bed.find(accessory.bedId)
      if (bed) {
        await BedAccessoryMove.create({
          bedAccessoryId: accessory.id,
          fromBedId: null,
          toBedId: bed.id,
          movedBy: auth.user?.id ?? null,
          movedAt: DateTime.now(),
          reason: 'initial placement',
        })
      }
    }

    await accessory.load('accessoryType')
    session.flash('success', `Accessory "${displayLabel(accessory)}" added.`)
    return response.redirect().toPath('/accessories')
  }

  async edit({ params, inertia }: HttpContext) {
    const accessory = await BedAccessory.findOrFail(params.accessory)
    return inertia.render('accessories/edit', {
      accessory: {
        id: accessory.id,
        accessoryTypeId: accessory.accessoryTypeId,
        assetTag: accessory.assetTag,
        name: accessory.name,
        bedId: accessory.bedId,
        status: accessory.status,
        notes: accessory.notes,
      },
      ...(await this.formOptions()),
    })
  }

  async update({ params, request, response, session, auth }: HttpContext) {
    const accessory = await BedAccessory.findOrFail(params.accessory)
    const data = await this.validateForm(request, accessory.id)

    if (data.asset_tag) {
      const dup = await BedAccessory.query()
        .where('assetTag', data.asset_tag)
        .whereNot('id', accessory.id)
        .first()
      if (dup) {
        session.flashErrors({ asset_tag: 'This asset tag is already in use.' })
        session.flashAll()
        return response.redirect().back()
      }
    }

    const newBedId = data.bed_id ?? null
    if (accessory.bedId !== newBedId) {
      await moveAccessory(accessory, newBedId, auth.user?.id ?? null, 'edit form')
    }

    accessory.merge({
      accessoryTypeId: data.accessory_type_id,
      assetTag: data.asset_tag ?? null,
      name: data.name ?? null,
      status: data.status ?? 'active',
      notes: data.notes ?? null,
    })
    await accessory.save()

    await accessory.load('accessoryType')
    session.flash('success', `Accessory "${displayLabel(accessory)}" updated.`)
    return response.redirect().toPath('/accessories')
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const accessory = await BedAccessory.findOrFail(params.accessory)
    if (accessory.bedId) {
      await moveAccessory(accessory, null, auth.user?.id ?? null, 'deleted')
    }
    await accessory.load('accessoryType')
    const label = displayLabel(accessory)
    await accessory.delete()

    session.flash('success', `Accessory "${label}" deleted.`)
    return response.redirect().toPath('/accessories')
  }

  async attach({ params, request, response, session, auth }: HttpContext) {
    const accessory = await BedAccessory.findOrFail(params.accessory)
    const validator = vine.compile(
      vine.object({
        to_bed_id: vine.number(),
        reason: vine.string().trim().maxLength(200).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const bed = await Bed.findOrFail(data.to_bed_id)
    await moveAccessory(accessory, bed.id, auth.user?.id ?? null, data.reason ?? 'attach')

    await accessory.load('accessoryType')
    session.flash('success', `Attached "${displayLabel(accessory)}" to bed ${bed.bedNumber}.`)
    return response.redirect().back()
  }

  async move({ params, request, response, session, auth }: HttpContext) {
    const accessory = await BedAccessory.findOrFail(params.accessory)
    const validator = vine.compile(
      vine.object({
        to_bed_id: vine.number().nullable().optional(),
        reason: vine.string().trim().maxLength(200).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const bed = data.to_bed_id ? await Bed.find(data.to_bed_id) : null
    await moveAccessory(accessory, bed?.id ?? null, auth.user?.id ?? null, data.reason ?? 'move')

    await accessory.load('accessoryType')
    const where = bed ? `to bed ${bed.bedNumber}` : 'to storage'
    session.flash('success', `Moved "${displayLabel(accessory)}" ${where}.`)
    return response.redirect().back()
  }

  async detach({ params, response, session, auth }: HttpContext) {
    const accessory = await BedAccessory.findOrFail(params.accessory)
    await moveAccessory(accessory, null, auth.user?.id ?? null, 'detach')

    await accessory.load('accessoryType')
    session.flash('success', `Detached "${displayLabel(accessory)}" to storage.`)
    return response.redirect().back()
  }

  private async formOptions() {
    const types = await AccessoryType.query().where('isActive', true).orderBy('name')
    const wards = await Ward.query()
      .where('isActive', true)
      .preload('beds', (q) => q.orderBy('bedNumber'))
      .orderBy('wing')
      .orderBy('name')

    return {
      types: types.map((t) => ({ id: t.id, name: t.name })),
      statuses: STATUSES,
      wards: wards.map((w) => ({
        id: w.id,
        name: w.name,
        wing: w.wing,
        beds: w.beds.map((b) => ({ id: b.id, bedNumber: b.bedNumber })),
      })),
    }
  }

  private async validateForm(request: HttpContext['request'], _ignoreId?: number) {
    const validator = vine.compile(
      vine.object({
        accessory_type_id: vine.number(),
        asset_tag: vine.string().trim().maxLength(64).nullable().optional(),
        name: vine.string().trim().maxLength(150).nullable().optional(),
        bed_id: vine.number().nullable().optional(),
        status: vine.enum(STATUSES),
        notes: vine.string().trim().maxLength(500).nullable().optional(),
      })
    )
    return request.validateUsing(validator)
  }
}
