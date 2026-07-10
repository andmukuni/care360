import LabResultForm from '#models/lab_result_form'
import LabResultFormField from '#models/lab_result_form_field'
import TestType from '#models/test_type'

export const LAB_RESULT_SYSTEM_KEYS = [
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
] as const

export type LabResultSystemKey = (typeof LAB_RESULT_SYSTEM_KEYS)[number]

export type SerializedLabResultFormField = {
  key: string
  label: string
  type: string
  options: string[]
  placeholder: string | null
  required: boolean
}

function decodeFieldOptions(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : []
  } catch {
    return raw
      .split(/\r\n|\r|\n|,/)
      .map((line) => line.trim())
      .filter(Boolean)
  }
}

export function usesCustomFields(form: LabResultForm, fieldsCount?: number): boolean {
  if (form.isSystem) return false
  if (typeof fieldsCount === 'number') return fieldsCount > 0
  return (form.labResultFormFields?.length ?? 0) > 0
}

export function renderTemplateKeyForForm(form: LabResultForm, fieldsCount?: number): string {
  if (usesCustomFields(form, fieldsCount)) {
    return 'custom'
  }

  const template = String(form.templateKey ?? '').trim()
  if (template && LAB_RESULT_SYSTEM_KEYS.includes(template as LabResultSystemKey)) {
    return template
  }

  if (form.isSystem && LAB_RESULT_SYSTEM_KEYS.includes(form.key as LabResultSystemKey)) {
    return form.key
  }

  return 'quantitative'
}

export async function buildTestFormKeyMap(): Promise<Record<string, string>> {
  const testTypes = await TestType.query()
    .where('is_active', true)
    .preload('labResultForm')

  const map: Record<string, string> = {}
  for (const testType of testTypes) {
    map[testType.name.trim().toUpperCase()] = testType.labResultForm?.key ?? 'quantitative'
  }
  return map
}

export async function buildFormRenderMap(): Promise<Record<string, string>> {
  const forms = await LabResultForm.query().withCount('labResultFormFields')
  const map: Record<string, string> = {}
  for (const form of forms) {
    map[form.key] = renderTemplateKeyForForm(form, Number(form.$extras.labResultFormFields_count ?? 0))
  }
  return map
}

export async function buildFormLabelMap(): Promise<Record<string, string>> {
  const forms = await LabResultForm.query().select(['key', 'label'])
  const map: Record<string, string> = {}
  for (const form of forms) {
    map[form.key] = form.label
  }
  return map
}

export async function buildFormFieldsMap(): Promise<Record<string, SerializedLabResultFormField[]>> {
  const forms = await LabResultForm.query()
    .where('is_system', false)
    .preload('labResultFormFields', (query) => {
      query.orderBy('sort_order', 'asc').orderBy('id', 'asc')
    })

  const map: Record<string, SerializedLabResultFormField[]> = {}
  for (const form of forms) {
    if (!form.labResultFormFields.length) continue
    map[form.key] = form.labResultFormFields.map((field: LabResultFormField) => ({
      key: field.key,
      label: field.label,
      type: field.fieldType,
      options: decodeFieldOptions(field.options),
      placeholder: field.placeholder,
      required: field.isRequired,
    }))
  }
  return map
}

export async function buildLabResultFormMaps() {
  const [testFormKeyMap, formRenderMap, formLabelMap, formFieldsMap] = await Promise.all([
    buildTestFormKeyMap(),
    buildFormRenderMap(),
    buildFormLabelMap(),
    buildFormFieldsMap(),
  ])

  return { testFormKeyMap, formRenderMap, formLabelMap, formFieldsMap }
}

export function deriveFormKey(
  testName: string,
  testFormKeyMap: Record<string, string>
): string {
  const normalized = testName.trim().toUpperCase()
  return testFormKeyMap[normalized] ?? 'quantitative'
}

export function resolveRenderType(
  formKey: string,
  formRenderMap: Record<string, string>
): string {
  return formRenderMap[formKey] ?? 'quantitative'
}
