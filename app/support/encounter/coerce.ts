import { DateTime } from 'luxon'

/**
 * Small coercion helpers used by the encounter actions to translate loosely
 * typed request payloads (mirroring the Laravel array $data contracts, keyed
 * in snake_case) into the shapes Lucid models expect.
 */

/**
 * Coerce a value that may be a string / Date / DateTime into a luxon DateTime.
 * Used for date + datetime columns. Returns null for empty/invalid input.
 */
export function toDateTime(value: unknown): DateTime | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (value instanceof DateTime) {
    return value.isValid ? value : null
  }
  if (value instanceof Date) {
    const fromDate = DateTime.fromJSDate(value)
    return fromDate.isValid ? fromDate : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return null
    }

    const iso = DateTime.fromISO(trimmed)
    if (iso.isValid) {
      return iso
    }

    const sql = DateTime.fromSQL(trimmed)
    if (sql.isValid) {
      return sql
    }

    const rfc = DateTime.fromRFC2822(trimmed)
    if (rfc.isValid) {
      return rfc
    }

    const weekdayMonthDay = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})(?:\s+(\d{4}))?$/)
    if (weekdayMonthDay) {
      const [, month, day, year] = weekdayMonthDay
      const parsed = DateTime.fromFormat(
        `${month} ${day} ${year ?? String(DateTime.now().year)}`,
        'LLL d yyyy'
      )
      if (parsed.isValid) {
        return parsed
      }
    }

    const jsDate = new Date(trimmed)
    if (!Number.isNaN(jsDate.getTime())) {
      const fromJs = DateTime.fromJSDate(jsDate)
      if (fromJs.isValid) {
        return fromJs
      }
    }

    for (const format of ['ccc LLL dd yyyy', 'ccc LLL dd', 'dd LLL yyyy', 'dd/MM/yyyy'] as const) {
      const parsed = DateTime.fromFormat(trimmed, format)
      if (parsed.isValid) {
        return parsed
      }
    }
  }
  return null
}

/** Normalise request/UI values to YYYY-MM-DD for Postgres date columns. */
export function toISODateString(value: unknown): string | null {
  return toDateTime(value)?.toISODate() ?? null
}

/**
 * Coerce to boolean when the value is present, otherwise return null.
 * Mirrors PHP `isset($x) ? (bool) $x : null`.
 */
export function toBoolOrNull(value: unknown): boolean | null {
  return value === undefined || value === null ? null : Boolean(value)
}

/**
 * Serialise a plain object to a JSON string for text/json columns, returning
 * null when the object is empty. Mirrors PHP `$values ?: null`.
 */
export function toJsonOrNull(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) {
    return null
  }
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return null
  }
  return JSON.stringify(value)
}

/**
 * Drop null / undefined / false-y-empty entries, mirroring PHP array_filter()
 * (which removes values that are loosely equal to false: null, false, 0, '', '0').
 */
export function arrayFilter(
  value: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value)) {
    if (val === null || val === undefined || val === false || val === 0 || val === '' || val === '0') {
      continue
    }
    out[key] = val
  }
  return out
}

const SCREENING_DATE_KEYS = [
  'last_menstrual_period',
  'expected_delivery_date',
  'cervical_screening_date',
] as const

const SCREENING_NUMERIC_KEYS = [
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
 * Coerce loosely typed screening autosave payloads (empty strings from HTML
 * date/number inputs) into the shapes screeningAssessmentValidator expects.
 */
export function normalizeScreeningAssessmentPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = { ...raw }

  for (const key of SCREENING_DATE_KEYS) {
    const value = cleaned[key]
    if (value === '' || value === null || value === undefined) {
      cleaned[key] = null
    }
  }

  for (const key of SCREENING_NUMERIC_KEYS) {
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

const TRIAGE_NUMERIC_KEYS = [
  'weight',
  'height',
  'temperature',
  'pulse',
  'respiratory_rate',
  'systolic_bp',
  'diastolic_bp',
  'oxygen_saturation',
  'blood_sugar',
  'pain_scale',
  'muac',
  'abdominal_circumference',
] as const

const TRIAGE_STRING_KEYS = [
  'muac_score',
  'chief_complaint_brief',
  'startup_interventions_notes',
  'startup_medications_notes',
  'triage_notes',
  'notes',
] as const

/**
 * Coerce loosely typed triage autosave payloads (empty strings, numeric strings)
 * into the shapes triageVitalsValidator expects.
 */
export function normalizeTriageVitalsPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}

  for (const key of TRIAGE_NUMERIC_KEYS) {
    const value = raw[key]
    if (value === '' || value === null || value === undefined) {
      cleaned[key] = null
      continue
    }
    const num = Number(value)
    cleaned[key] = Number.isFinite(num) ? num : value
  }

  for (const key of TRIAGE_STRING_KEYS) {
    const value = raw[key]
    if (value === null || value === undefined) {
      cleaned[key] = null
      continue
    }
    const str = String(value).trim()
    cleaned[key] = str === '' ? null : str
  }

  return cleaned
}
