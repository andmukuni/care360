import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import LabSpecimenType from '#models/lab_specimen_type'

/**
 * Lab specimen ("test sample") types CRUD. Ported from
 * App\Http\Controllers\LabSpecimenTypeController.
 *
 * The Laravel server-side DataTables `datatable` endpoint is collapsed into
 * `index`, which returns the full ordered list (with linked test counts) to the
 * Inertia page for a client-side DataTable. The discipline labels used by the
 * create/edit forms are distinct non-empty test-type descriptions.
 */
export default class LabSpecimenTypesController {
  async index({ inertia }: HttpContext) {
    const specimenTypes = await LabSpecimenType.query()
      .withCount('testTypes')
      .orderBy('name')
      .orderBy('id')

    return inertia.render('lab/specimen-types/index', {
      specimenTypes: specimenTypes.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        defaultUnit: s.defaultUnit,
        testCategory: s.testCategory,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        linkedTests: Number(s.$extras.testTypes_count ?? 0),
      })),
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('lab/specimen-types/create', {
      disciplines: await this.disciplineLabels(),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await this.validate(request)

    const dup = await LabSpecimenType.query().where('name', data.name).first()
    if (dup) {
      session.flashErrors({ name: 'A sample type with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    await LabSpecimenType.create({
      name: data.name,
      code: this.cleanup(data.code),
      defaultUnit: this.cleanup(data.default_unit),
      testCategory: this.cleanup(data.test_category),
      sortOrder: data.sort_order ?? 0,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : true,
    })

    session.flash('success', 'Test sample type created.')
    return response.redirect().toPath('/lab/specimen-types')
  }

  async show({ params, inertia }: HttpContext) {
    const specimenType = await LabSpecimenType.query()
      .where('id', params.labSpecimenType)
      .withCount('testTypes')
      .firstOrFail()

    return inertia.render('lab/specimen-types/show', {
      specimenType: {
        id: specimenType.id,
        name: specimenType.name,
        code: specimenType.code,
        defaultUnit: specimenType.defaultUnit,
        testCategory: specimenType.testCategory,
        sortOrder: specimenType.sortOrder,
        isActive: specimenType.isActive,
        linkedTests: Number(specimenType.$extras.testTypes_count ?? 0),
      },
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const specimenType = await LabSpecimenType.findOrFail(params.labSpecimenType)
    return inertia.render('lab/specimen-types/edit', {
      specimenType: {
        id: specimenType.id,
        name: specimenType.name,
        code: specimenType.code,
        defaultUnit: specimenType.defaultUnit,
        testCategory: specimenType.testCategory,
        sortOrder: specimenType.sortOrder,
        isActive: specimenType.isActive,
      },
      disciplines: await this.disciplineLabels(),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const specimenType = await LabSpecimenType.findOrFail(params.labSpecimenType)
    const data = await this.validate(request)

    const dup = await LabSpecimenType.query()
      .where('name', data.name)
      .whereNot('id', specimenType.id)
      .first()
    if (dup) {
      session.flashErrors({ name: 'A sample type with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    specimenType.merge({
      name: data.name,
      code: this.cleanup(data.code),
      defaultUnit: this.cleanup(data.default_unit),
      testCategory: this.cleanup(data.test_category),
      sortOrder: data.sort_order ?? specimenType.sortOrder,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : false,
    })
    await specimenType.save()

    session.flash('success', 'Test sample type updated.')
    return response.redirect().toPath(`/lab/specimen-types/${specimenType.id}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const specimenType = await LabSpecimenType.findOrFail(params.labSpecimenType)
    await specimenType.delete()

    session.flash('success', 'Test sample type deleted.')
    return response.redirect().toPath('/lab/specimen-types')
  }

  private cleanup(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim()
    return trimmed !== '' ? trimmed : null
  }

  private async disciplineLabels(): Promise<string[]> {
    const rows = await db
      .from('test_types')
      .distinct('description')
      .whereNotNull('description')
      .where('description', '!=', '')
      .orderBy('description')
    return rows.map((r) => r.description as string)
  }

  private async validate(request: HttpContext['request']) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(150),
        code: vine.string().trim().maxLength(40).nullable().optional(),
        default_unit: vine.string().trim().maxLength(80).nullable().optional(),
        test_category: vine.string().trim().maxLength(100).nullable().optional(),
        sort_order: vine.number().min(0).max(65535).optional(),
        is_active: vine.any().optional(),
      })
    )
    return request.validateUsing(validator)
  }
}
