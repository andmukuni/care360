import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import TestType from '#models/test_type'
import LabResultForm from '#models/lab_result_form'
import LabSpecimenType from '#models/lab_specimen_type'

/**
 * Test types (lab tests) CRUD + the "categories" summary page. Ported from
 * App\Http\Controllers\TestTypeController.
 *
 * The Laravel `datatable` / `categoriesDatatable` server-side JSON endpoints are
 * collapsed into `index` and `categories`, which return the full ordered rows to
 * the Inertia pages (rendered with the shared client-side DataTable).
 */
export default class TestTypesController {
  async index({ inertia }: HttpContext) {
    const testTypes = await TestType.query()
      .preload('labSpecimenType')
      .preload('labResultForm')
      .orderBy('name')

    const categories = await this.distinctDescriptions()

    return inertia.render('test-types/index', {
      testTypes: testTypes.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.labSpecimenType?.testCategory ?? null,
        resultForm: t.labResultForm?.label ?? '—',
        isActive: t.isActive,
      })),
      categories,
    })
  }

  /**
   * GET /test-types/categories — descriptions grouped with test counts.
   */
  async categories({ inertia }: HttpContext) {
    const rows = await db
      .from('test_types')
      .whereNotNull('description')
      .where('description', '!=', '')
      .select('description')
      .count('* as test_count')
      .sum('is_active as active_count')
      .min('created_at as first_added')
      .groupBy('description')
      .orderBy('description')

    return inertia.render('test-types/categories', {
      categories: rows.map((r) => ({
        category: r.description ?? '—',
        testCount: Number(r.test_count ?? 0),
        activeCount: Number(r.active_count ?? 0),
      })),
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('test-types/create', await this.formOptions())
  }

  async store({ request, response, session }: HttpContext) {
    const data = await this.validate(request)

    const dup = await TestType.query().where('name', data.name).first()
    if (dup) {
      session.flashErrors({ name: 'A test type with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    await TestType.create({
      name: data.name,
      labSpecimenTypeId: data.lab_specimen_type_id,
      labResultFormId: data.lab_result_form_id,
      description: data.description ? data.description.trim() : null,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : true,
    })

    session.flash('success', 'Test type created.')
    return response.redirect().toPath('/test-types')
  }

  async show({ params, inertia }: HttpContext) {
    const testType = await TestType.query()
      .where('id', params.testType)
      .preload('labResultForm')
      .preload('labSpecimenType')
      .firstOrFail()

    return inertia.render('test-types/show', {
      testType: {
        id: testType.id,
        name: testType.name,
        description: testType.description,
        isActive: testType.isActive,
        specimenType: testType.labSpecimenType
          ? { id: testType.labSpecimenType.id, name: testType.labSpecimenType.name, testCategory: testType.labSpecimenType.testCategory }
          : null,
        resultForm: testType.labResultForm
          ? { id: testType.labResultForm.id, label: testType.labResultForm.label }
          : null,
      },
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const testType = await TestType.findOrFail(params.testType)
    return inertia.render('test-types/edit', {
      testType: {
        id: testType.id,
        name: testType.name,
        description: testType.description,
        labSpecimenTypeId: testType.labSpecimenTypeId,
        labResultFormId: testType.labResultFormId,
        isActive: testType.isActive,
      },
      ...(await this.formOptions()),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const testType = await TestType.findOrFail(params.testType)
    const data = await this.validate(request)

    const dup = await TestType.query().where('name', data.name).whereNot('id', testType.id).first()
    if (dup) {
      session.flashErrors({ name: 'A test type with this name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    testType.merge({
      name: data.name,
      labSpecimenTypeId: data.lab_specimen_type_id,
      labResultFormId: data.lab_result_form_id,
      description: data.description ? data.description.trim() : null,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : false,
    })
    await testType.save()

    session.flash('success', 'Test type updated.')
    return response.redirect().toPath(`/test-types/${testType.id}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const testType = await TestType.findOrFail(params.testType)
    await testType.delete()

    session.flash('success', 'Test type deleted.')
    return response.redirect().toPath('/test-types')
  }

  private async distinctDescriptions(): Promise<string[]> {
    const rows = await db
      .from('test_types')
      .distinct('description')
      .whereNotNull('description')
      .where('description', '!=', '')
      .orderBy('description')
    return rows.map((r) => r.description as string)
  }

  private async formOptions() {
    const categories = await LabSpecimenType.query()
      .orderByRaw('CASE WHEN test_category IS NULL THEN 1 ELSE 0 END')
      .orderBy('testCategory')
      .orderBy('name')
      .select('id', 'name', 'testCategory')

    const resultForms = await LabResultForm.query()
      .where('isActive', true)
      .orderBy('sortOrder')
      .orderBy('label')
      .select('id', 'key', 'label', 'description')

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        testCategory: c.testCategory,
      })),
      resultForms: resultForms.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        description: f.description,
      })),
    }
  }

  private async validate(request: HttpContext['request']) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(100),
        lab_specimen_type_id: vine.number(),
        lab_result_form_id: vine.number(),
        description: vine.string().trim().maxLength(255).nullable().optional(),
        is_active: vine.any().optional(),
      })
    )
    return request.validateUsing(validator)
  }
}
