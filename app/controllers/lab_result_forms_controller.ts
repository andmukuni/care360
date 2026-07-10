import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import LabResultForm from '#models/lab_result_form'
import TestType from '#models/test_type'

/**
 * Lab result form templates CRUD. Ported from
 * App\Http\Controllers\LabResultFormController.
 *
 * Notable adaptations:
 * - The Laravel `LabResultForm` caching helpers (key/render/label maps + the
 *   `flushKeyCache()` calls) have no Adonis equivalent yet, so they are dropped;
 *   `idForKey('quantitative')` is resolved with a direct query.
 * - MODEL GAP: the Adonis `LabResultFormField.options` column is a plain
 *   `string | null` (Laravel cast it to an array/JSON). Options are therefore
 *   JSON-encoded on write and JSON-decoded on read here.
 * - Test-type assignment reuses the Laravel logic: assigned test types point
 *   their `lab_result_form_id` at this form, unassigned ones fall back to the
 *   default "quantitative" form.
 */
const FIELD_TYPES = ['text', 'number', 'textarea', 'select'] as const

const SYSTEM_KEYS = [
  'quantitative',
  'rapid_test',
  'reactive_test',
  'fbc',
  'stool_analysis',
  'urine_chemistry',
  'urine_microscopy',
  'urine_macroscopy',
  'hvs',
  'koh',
]

const TEMPLATE_OPTIONS: Record<string, string> = {
  quantitative: 'Quantitative — numeric value + range',
  rapid_test: 'Rapid test — Positive / Negative',
  reactive_test: 'Reactive test — Reactive / Non-Reactive',
  fbc: 'Full blood count — 19-parameter panel',
  stool_analysis: 'Stool analysis — macro + micro',
  urine_chemistry: 'Urine chemistry — dipstick panel',
  urine_microscopy: 'Urine microscopy — 9-parameter panel',
  urine_macroscopy: 'Urine macroscopy — colour + turbidity',
  hvs: 'High vaginal swab — microscopy',
  koh: 'KOH preparation — yeast seen / not seen',
}

interface FieldRowInput {
  key?: string
  label?: string
  field_type?: string
  options_text?: string
  placeholder?: string
  is_required?: boolean | string | number
}

function snake(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function parseOptions(raw: string): string[] {
  return raw
    .split(/\r\n|\r|\n|,/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function decodeOptions(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
  } catch {
    return []
  }
}

export default class LabResultFormsController {
  async index({ inertia }: HttpContext) {
    const forms = await LabResultForm.query()
      .withCount('testTypes')
      .withCount('labTestCatalog')
      .withCount('labResultFormFields')
      .orderBy('sortOrder')
      .orderBy('label')

    return inertia.render('test-types/forms/index', {
      forms: forms.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        description: f.description,
        sortOrder: f.sortOrder,
        isActive: f.isActive,
        isSystem: f.isSystem,
        testTypesCount: Number(f.$extras.testTypes_count ?? 0),
        catalogCount: Number(f.$extras.labTestCatalog_count ?? 0),
        fieldsCount: Number(f.$extras.labResultFormFields_count ?? 0),
      })),
    })
  }

  async create({ inertia }: HttpContext) {
    const maxSort = await LabResultForm.query().max('sort_order as max')
    const nextSort = Number((maxSort[0] as any)?.$extras?.max ?? 0) + 1

    return inertia.render('test-types/forms/create', {
      form: {
        key: '',
        label: '',
        description: '',
        templateKey: 'quantitative',
        sortOrder: nextSort,
        isActive: true,
        isSystem: false,
      },
      templateOptions: TEMPLATE_OPTIONS,
      fieldRows: [],
      testTypes: await this.testTypeOptions(),
      selectedTestTypeIds: [],
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await this.validateForm(request, session)
    if (data === null) {
      return response.redirect().back()
    }

    const form = await LabResultForm.create({
      key: data.key,
      label: data.label,
      description: data.description ?? null,
      templateKey: data.template_key ?? 'quantitative',
      sortOrder: data.sort_order,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : true,
      isSystem: false,
    })

    await this.syncFields(form, request.input('fields', []))
    await this.syncTestTypes(form, request.input('test_type_ids', []))

    session.flash('success', 'Result form created.')
    return response.redirect().toPath(`/test-types/forms/${form.id}`)
  }

  async show({ params, inertia }: HttpContext) {
    const form = await LabResultForm.query()
      .where('id', params.labResultForm)
      .preload('labResultFormFields', (q) => q.orderBy('sortOrder').orderBy('id'))
      .preload('testTypes', (q) => q.preload('labSpecimenType'))
      .withCount('testTypes')
      .withCount('labTestCatalog')
      .firstOrFail()

    return inertia.render('test-types/forms/show', {
      form: {
        id: form.id,
        key: form.key,
        label: form.label,
        description: form.description,
        templateKey: form.templateKey,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        isSystem: form.isSystem,
        testTypesCount: Number(form.$extras.testTypes_count ?? 0),
        catalogCount: Number(form.$extras.labTestCatalog_count ?? 0),
        fields: form.labResultFormFields.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
          options: decodeOptions(field.options),
          placeholder: field.placeholder,
          isRequired: field.isRequired,
        })),
        testTypes: form.testTypes.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.labSpecimenType?.testCategory ?? null,
        })),
      },
    })
  }

  async edit({ params, inertia }: HttpContext) {
    const form = await LabResultForm.query()
      .where('id', params.labResultForm)
      .preload('labResultFormFields', (q) => q.orderBy('sortOrder').orderBy('id'))
      .firstOrFail()

    const selectedTestTypeIds = (
      await TestType.query().where('labResultFormId', form.id).select('id')
    ).map((t) => t.id)

    return inertia.render('test-types/forms/edit', {
      form: {
        id: form.id,
        key: form.key,
        label: form.label,
        description: form.description,
        templateKey: form.templateKey,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        isSystem: form.isSystem,
      },
      templateOptions: TEMPLATE_OPTIONS,
      fieldRows: form.labResultFormFields.map((field) => ({
        key: field.key,
        label: field.label,
        field_type: field.fieldType,
        options_text: decodeOptions(field.options).join('\n'),
        placeholder: field.placeholder ?? '',
        is_required: field.isRequired,
      })),
      testTypes: await this.testTypeOptions(),
      selectedTestTypeIds,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const form = await LabResultForm.findOrFail(params.labResultForm)
    const data = await this.validateForm(request, session, form)
    if (data === null) {
      return response.redirect().back()
    }

    form.merge({
      key: form.isSystem ? form.key : data.key,
      label: data.label,
      description: data.description ?? null,
      templateKey: form.isSystem ? form.templateKey : (data.template_key ?? form.templateKey),
      sortOrder: data.sort_order,
      isActive: request.input('is_active') !== undefined ? request.input('is_active') !== false : false,
    })
    await form.save()

    if (!form.isSystem) {
      await this.syncFields(form, request.input('fields', []))
    }
    await this.syncTestTypes(form, request.input('test_type_ids', []))

    session.flash('success', 'Result form updated.')
    return response.redirect().toPath(`/test-types/forms/${form.id}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const form = await LabResultForm.findOrFail(params.labResultForm)

    if (form.isSystem) {
      session.flash('error', 'System forms cannot be deleted.')
      return response.redirect().toPath('/test-types/forms')
    }

    const assignedTestTypes = await TestType.query().where('labResultFormId', form.id).first()
    const assignedCatalog = await form.related('labTestCatalog').query().first()
    if (assignedTestTypes || assignedCatalog) {
      session.flash(
        'error',
        'This form is assigned to test types or catalog entries. Reassign them first.'
      )
      return response.redirect().toPath(`/test-types/forms/${form.id}`)
    }

    await form.delete()

    session.flash('success', 'Result form deleted.')
    return response.redirect().toPath('/test-types/forms')
  }

  private async testTypeOptions() {
    const types = await TestType.query()
      .where('isActive', true)
      .preload('labSpecimenType')
      .preload('labResultForm')
      .orderBy('name')

    return types.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.labSpecimenType?.testCategory ?? null,
      current_form: t.labResultForm?.label ?? null,
    }))
  }

  private async syncFields(form: LabResultForm, rows: FieldRowInput[]): Promise<void> {
    await form.related('labResultFormFields').query().delete()

    if (!Array.isArray(rows)) return

    let sort = 0
    for (const row of rows) {
      const label = String(row?.label ?? '').trim()
      if (label === '') continue

      let key = String(row?.key ?? '').trim()
      if (key === '') key = snake(label)

      let fieldType = String(row?.field_type ?? 'text')
      if (!FIELD_TYPES.includes(fieldType as any)) fieldType = 'text'

      const options = parseOptions(String(row?.options_text ?? ''))
      const placeholder = String(row?.placeholder ?? '').trim()

      await form.related('labResultFormFields').create({
        key,
        label,
        fieldType,
        options: fieldType === 'select' ? JSON.stringify(options) : null,
        placeholder: placeholder !== '' ? placeholder : null,
        sortOrder: sort++,
        isRequired: row?.is_required === true || row?.is_required === 'true' || row?.is_required === 1,
      })
    }
  }

  private async syncTestTypes(form: LabResultForm, selected: (number | string)[]): Promise<void> {
    const selectedIds = Array.from(
      new Set((Array.isArray(selected) ? selected : []).map((id) => Number(id)).filter((id) => id > 0))
    )

    const defaultFormId = await this.idForKey('quantitative')

    const releaseQuery = TestType.query().where('labResultFormId', form.id)
    if (selectedIds.length > 0) {
      releaseQuery.whereNotIn('id', selectedIds)
    }
    await releaseQuery.update({ lab_result_form_id: defaultFormId })

    if (selectedIds.length > 0) {
      await TestType.query().whereIn('id', selectedIds).update({ lab_result_form_id: form.id })
    }
  }

  private async idForKey(key: string): Promise<number> {
    const k = key.trim() !== '' ? key.trim() : 'quantitative'
    let form = await LabResultForm.findBy('key', k)
    if (!form) form = await LabResultForm.findBy('key', 'quantitative')
    if (!form) {
      throw new Error('lab_result_forms is empty; run the LabResultForms seeder first.')
    }
    return form.id
  }

  /**
   * Validates the scalar form fields and applies the not-system-only key rules.
   * Returns null (after flashing errors) when validation fails a manual check.
   */
  private async validateForm(
    request: HttpContext['request'],
    session: HttpContext['session'],
    existing?: LabResultForm
  ) {
    const isSystem = existing?.isSystem ?? false

    const validator = vine.compile(
      vine.object({
        label: vine.string().trim().maxLength(120),
        description: vine.string().trim().maxLength(255).nullable().optional(),
        sort_order: vine.number().min(0).max(9999),
        key: vine
          .string()
          .trim()
          .maxLength(50)
          .regex(/^[a-z][a-z0-9_]*$/)
          .optional(),
        template_key: vine.string().trim().nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    if (!isSystem) {
      const key = data.key ?? ''
      const fail = (field: string, message: string) => {
        session.flashErrors({ [field]: message })
        session.flashAll()
        return null
      }
      if (key === '') return fail('key', 'The key field is required.')
      if (SYSTEM_KEYS.includes(key)) return fail('key', 'This key is reserved for a system form.')

      const dup = await LabResultForm.query()
        .where('key', key)
        .if(existing, (q) => q.whereNot('id', existing!.id))
        .first()
      if (dup) return fail('key', 'This key is already in use.')

      if (data.template_key && !SYSTEM_KEYS.includes(data.template_key)) {
        return fail('template_key', 'Invalid template.')
      }
    }

    return data
  }
}
