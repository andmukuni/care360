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
    return value
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value)
  }
  if (typeof value === 'string') {
    const iso = DateTime.fromISO(value)
    if (iso.isValid) {
      return iso
    }
    const sql = DateTime.fromSQL(value)
    return sql.isValid ? sql : null
  }
  return null
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
