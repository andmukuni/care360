const DATE_KEYS = [
  'last_menstrual_period',
  'expected_delivery_date',
  'cervical_screening_date',
] as const

const NUMERIC_KEYS = [
  'birth_weight',
  'birth_length',
  'head_circumference',
  'chest_circumference',
  'cycle_length_days',
  'duration_of_flow_days',
  'gravida',
  'para',
  'abortus',
  'living_children',
  'contraceptive_duration_months',
] as const

/**
 * Coerce empty strings from HTML date/number inputs before autosave POST.
 * Mirrors app/support/encounter/coerce.ts normalizeScreeningAssessmentPayload.
 */
export function normalizeScreeningPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = { ...raw }

  for (const key of DATE_KEYS) {
    const value = cleaned[key]
    if (value === '' || value === null || value === undefined) {
      cleaned[key] = null
    }
  }

  for (const key of NUMERIC_KEYS) {
    const value = cleaned[key]
    if (value === '' || value === null || value === undefined) {
      cleaned[key] = null
      continue
    }
    const num = Number(value)
    cleaned[key] = Number.isFinite(num) ? num : value
  }

  return cleaned
}
