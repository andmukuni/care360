import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import Medication from '#models/medication'
import ReferenceDataCache from '#services/cache/reference_data_cache'

/**
 * Medications CRUD. Ported from App\Http\Controllers\MedicationController.
 *
 * MODEL GAP: the Adonis Medication model has a plain `unit` string column and NO
 * `units` many-to-many relation (Laravel synced a units pivot + derived
 * form/strength from a `units_text` textarea). That pivot logic is dropped here;
 * the form edits the simple fields present on the model directly. The Laravel
 * server-side DataTables `datatable` endpoint is collapsed into `index`
 * (full ordered list rendered client-side).
 */
export default class MedicationsController {
  async index({ request, inertia }: HttpContext) {
    const qs = request.qs()
    const search = qs.search ? String(qs.search).trim() : ''
    const category = qs.category ? String(qs.category) : ''

    const allMedications = await ReferenceDataCache.medicationsAll(async () => {
      const rows = await Medication.query().orderBy('category').orderBy('name')
      return rows.map((m) => m.serialize())
    })

    const medications = allMedications
      .filter((m) => {
        if (category !== '' && m.category !== category) return false
        if (search === '') return true
        const haystack = `${m.name} ${m.genericName ?? ''} ${m.unit ?? ''}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
      .map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        genericName: m.genericName,
        category: m.category,
        defaultRoute: m.defaultRoute,
        defaultFrequency: m.defaultFrequency,
        isControlled: m.isControlled,
        isActive: m.isActive,
      }))

    return inertia.render('medications/index', {
      medications,
      categories: await this.categories(),
      search,
      category,
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('medications/create', { categories: await this.categories() })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await this.validate(request)

    const dup = await Medication.query().where('name', data.name).first()
    if (dup) {
      session.flashErrors({ name: 'A medication with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    await Medication.create({
      name: data.name,
      unit: data.unit ?? null,
      genericName: data.generic_name ?? null,
      category: data.category,
      form: data.form,
      strength: data.strength ?? null,
      defaultRoute: data.default_route ?? null,
      defaultFrequency: data.default_frequency ?? null,
      isControlled: request.input('is_controlled') !== undefined && request.input('is_controlled') !== false,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : true,
      notes: data.notes ?? null,
    })

    session.flash('success', 'Medication created.')
    return response.redirect().toPath('/medications')
  }

  async show({ params, inertia }: HttpContext) {
    const medication = await Medication.findOrFail(params.medication)
    return inertia.render('medications/show', { medication: this.serialize(medication) })
  }

  async edit({ params, inertia }: HttpContext) {
    const medication = await Medication.findOrFail(params.medication)
    return inertia.render('medications/edit', {
      medication: this.serialize(medication),
      categories: await this.categories(),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const medication = await Medication.findOrFail(params.medication)
    const data = await this.validate(request)

    const dup = await Medication.query().where('name', data.name).whereNot('id', medication.id).first()
    if (dup) {
      session.flashErrors({ name: 'A medication with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    medication.merge({
      name: data.name,
      unit: data.unit ?? null,
      genericName: data.generic_name ?? null,
      category: data.category,
      form: data.form,
      strength: data.strength ?? null,
      defaultRoute: data.default_route ?? null,
      defaultFrequency: data.default_frequency ?? null,
      isControlled: request.input('is_controlled') !== undefined && request.input('is_controlled') !== false,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : false,
      notes: data.notes ?? null,
    })
    await medication.save()

    session.flash('success', 'Medication updated.')
    return response.redirect().toPath(`/medications/${medication.id}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const medication = await Medication.findOrFail(params.medication)
    await medication.delete()

    session.flash('success', 'Medication deleted.')
    return response.redirect().toPath('/medications')
  }

  private serialize(m: Medication) {
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      genericName: m.genericName,
      category: m.category,
      form: m.form,
      strength: m.strength,
      defaultRoute: m.defaultRoute,
      defaultFrequency: m.defaultFrequency,
      isControlled: m.isControlled,
      isActive: m.isActive,
      notes: m.notes,
    }
  }

  private async categories(): Promise<string[]> {
    return ReferenceDataCache.medicationCategories(async () => {
      const rows = await db
        .from('medications')
        .distinct('category')
        .whereNotNull('category')
        .orderBy('category')
      return rows.map((r) => r.category as string)
    })
  }

  private async validate(request: HttpContext['request']) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(255),
        category: vine.string().trim().maxLength(100),
        form: vine.string().trim().maxLength(100),
        unit: vine.string().trim().maxLength(100).nullable().optional(),
        strength: vine.string().trim().maxLength(100).nullable().optional(),
        generic_name: vine.string().trim().maxLength(255).nullable().optional(),
        default_route: vine.string().trim().maxLength(50).nullable().optional(),
        default_frequency: vine.string().trim().maxLength(50).nullable().optional(),
        is_controlled: vine.any().optional(),
        is_active: vine.any().optional(),
        notes: vine.string().trim().maxLength(1000).nullable().optional(),
      })
    )
    return request.validateUsing(validator)
  }
}
