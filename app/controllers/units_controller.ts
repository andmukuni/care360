import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Unit from '#models/unit'

/**
 * Units CRUD. Ported from App\Http\Controllers\UnitController.
 *
 * A "unit" is a medication packaging descriptor (form + strength). The Laravel
 * version exposed jQuery DataTables JSON endpoints; here index/search return the
 * rows directly to the Inertia pages (rendered with the shared DataTable).
 */
function splitUnit(name: string): [string | null, string | null] {
  const parts = name.trim().split(/\s+/)
  const form = (parts.shift() ?? '').trim()
  const strength = parts.join(' ').trim()
  return [form !== '' ? form : null, strength !== '' ? strength : null]
}

export default class UnitsController {
  async index({ inertia }: HttpContext) {
    const units = await Unit.query().orderBy('name')
    return inertia.render('units/index', {
      units: units.map((u) => ({ id: u.id, name: u.name, form: u.form, strength: u.strength })),
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('units/create')
  }

  async store({ request, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(100),
      })
    )
    const { name } = await request.validateUsing(validator)

    const [form, strength] = splitUnit(name)
    await Unit.create({ name, form, strength })

    session.flash('success', 'Unit created.')
    return response.redirect().toPath('/units')
  }

  async show({ params, inertia }: HttpContext) {
    const unit = await Unit.findOrFail(params.unit)
    return inertia.render('units/show', {
      unit: { id: unit.id, name: unit.name, form: unit.form, strength: unit.strength },
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const unit = await Unit.findOrFail(params.unit)
    return inertia.render('units/edit', {
      unit: { id: unit.id, name: unit.name, form: unit.form, strength: unit.strength },
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const unit = await Unit.findOrFail(params.unit)
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(100),
      })
    )
    const { name } = await request.validateUsing(validator)

    const [form, strength] = splitUnit(name)
    unit.merge({ name, form, strength })
    await unit.save()

    session.flash('success', 'Unit updated.')
    return response.redirect().toPath(`/units/${unit.id}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const unit = await Unit.findOrFail(params.unit)
    await unit.delete()

    session.flash('success', 'Unit deleted.')
    return response.redirect().toPath('/units')
  }

  /**
   * GET /units/search?q= — lightweight autocomplete JSON for the medication
   * form picker.
   */
  async search({ request, response }: HttpContext) {
    const q = String(request.qs().q ?? '').trim()
    const units = await Unit.query()
      .if(q !== '', (query) =>
        query
          .whereILike('name', `%${q}%`)
          .orWhereILike('form', `%${q}%`)
          .orWhereILike('strength', `%${q}%`)
      )
      .orderBy('name')
      .limit(30)

    return response.json(
      units.map((u) => ({ id: u.id, name: u.name, form: u.form, strength: u.strength }))
    )
  }
}
