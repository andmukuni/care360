import { ageInMonths } from '~/support/format_age'

export type VitalBadge = {
  label: string
  bg: string
  color: string
  abnormal: boolean
}

const NORMAL = { bg: '#dcfce7', color: '#166534' }
const ELEVATED = { bg: '#ffedd5', color: '#9a3412' }
const ABNORMAL = { bg: '#fee2e2', color: '#991b1b' }
const CRITICAL = { bg: '#fecaca', color: '#7f1d1d' }
const LOW = { bg: '#dbeafe', color: '#1e40af' }
const WARNING = { bg: '#fef3c7', color: '#92400e' }

function badge(
  label: string,
  palette: { bg: string; color: string },
  abnormal: boolean
): VitalBadge {
  return { label, ...palette, abnormal }
}

function parseNum(value: number | string | null | undefined): number | null {
  const n = parseFloat(String(value ?? ''))
  return Number.isNaN(n) ? null : n
}

/**
 * Age-band helpers for vital sign ranges.
 *
 * Vitals (heart rate, breathing rate, blood pressure) change substantially
 * with age in children — using adult ranges on a 3-month-old reads a normal
 * infant heart rate of 140 bpm as "Tachycardia". Bands below follow
 * standard paediatric references:
 *  - Heart rate: PALS/AHA age-band awake heart rate ranges.
 *  - Respiratory rate: WHO IMCI fast-breathing thresholds for under-5s
 *    (<2 months / 2–<12 months / 12–<60 months), extended to older
 *    children with PALS-derived school-age/adolescent ranges.
 *  - Blood pressure: AHA/PALS/ATLS hypotension formula for 1–<10 years
 *    (SBP < 70 + 2×age), fixed neonate/infant bands, adult rules from
 *    10 years up. Diastolic pediatric bands are scaled approximations
 *    (no single widely-cited simple formula exists for diastolic) —
 *    adequate for a triage flag, not a diagnostic threshold.
 */
type PediatricBand = 'neonate' | 'infant' | 'toddler' | 'preschool' | 'school_age' | 'adolescent'

/** null = adult range (≥16y, or age unknown). */
function pediatricBand(ageMonths: number | null): PediatricBand | null {
  if (ageMonths === null) return null
  if (ageMonths < 1) return 'neonate'
  if (ageMonths < 12) return 'infant'
  if (ageMonths < 36) return 'toddler'
  if (ageMonths < 72) return 'preschool'
  if (ageMonths < 144) return 'school_age'
  if (ageMonths < 192) return 'adolescent'
  return null
}

/** Normal adult oral/axillary range: 36.0–37.4 °C */
const TEMP_NORMAL_MIN = 36.0
const TEMP_NORMAL_MAX = 37.4

export function temperatureBadge(
  celsius: number | string | null | undefined,
  dateOfBirth?: string | null
): VitalBadge | null {
  const temp = parseNum(celsius)
  if (temp === null) return null

  // WHO "warm chain" newborn thermal care thresholds (axillary, °C).
  if ((ageInMonths(dateOfBirth) ?? Infinity) < 1) {
    if (temp > 37.5) return badge('Fever', ABNORMAL, true)
    if (temp >= 36.5) return badge('Normal', NORMAL, false)
    if (temp >= 36.0) return badge('Cold stress', WARNING, true)
    if (temp >= 32.0) return badge('Hypothermia', ABNORMAL, true)
    return badge('Severe hypothermia', CRITICAL, true)
  }

  if (temp >= 39) return badge('High fever', CRITICAL, true)
  if (temp >= 38) return badge('Fever', ABNORMAL, true)
  if (temp > TEMP_NORMAL_MAX) return badge('Elevated', ELEVATED, true)
  if (temp >= TEMP_NORMAL_MIN) return badge('Normal', NORMAL, false)
  if (temp >= 35) return badge('Low', LOW, true)
  if (temp >= 32) return badge('Hypothermia', WARNING, true)
  return badge('Severe hypothermia', CRITICAL, true)
}

/** PALS/AHA awake heart rate ranges (bpm) by age band. */
const PEDIATRIC_PULSE_RANGE: Record<PediatricBand, { min: number; max: number }> = {
  neonate: { min: 100, max: 205 },
  infant: { min: 100, max: 190 },
  toddler: { min: 98, max: 140 },
  preschool: { min: 80, max: 120 },
  school_age: { min: 75, max: 118 },
  adolescent: { min: 60, max: 100 },
}

/** Adult resting pulse: 60–100 bpm. Pediatric ranges: see PEDIATRIC_PULSE_RANGE. */
export function pulseBadge(
  bpm: number | string | null | undefined,
  dateOfBirth?: string | null
): VitalBadge | null {
  const pulse = parseNum(bpm)
  if (pulse === null) return null

  const band = pediatricBand(ageInMonths(dateOfBirth))
  if (band) {
    const { min, max } = PEDIATRIC_PULSE_RANGE[band]
    if (pulse > max + 20) return badge('Tachycardia', CRITICAL, true)
    if (pulse > max) return badge('Fast', ABNORMAL, true)
    if (pulse >= min) return badge('Normal', NORMAL, false)
    if (pulse >= min - 15) return badge('Slow', ELEVATED, true)
    return badge('Bradycardia', CRITICAL, true)
  }

  if (pulse > 120) return badge('Tachycardia', CRITICAL, true)
  if (pulse > 100) return badge('Fast', ABNORMAL, true)
  if (pulse >= 60) return badge('Normal', NORMAL, false)
  if (pulse >= 50) return badge('Slow', ELEVATED, true)
  if (pulse >= 40) return badge('Bradycardia', ABNORMAL, true)
  return badge('Critical', CRITICAL, true)
}

type RrThresholds = { min: number; fast: number; critical: number; criticalLow: number }

/** WHO IMCI fast-breathing cutoffs (<5y) + PALS-derived ranges for older children (breaths/min). */
function respiratoryThresholds(ageMonths: number | null): RrThresholds | null {
  if (ageMonths === null) return null
  if (ageMonths < 2) return { min: 30, fast: 60, critical: 70, criticalLow: 20 } // WHO: <2 months
  if (ageMonths < 12) return { min: 30, fast: 50, critical: 65, criticalLow: 20 } // WHO: 2–<12 months
  if (ageMonths < 60) return { min: 20, fast: 40, critical: 60, criticalLow: 12 } // WHO: 12–<60 months
  if (ageMonths < 144) return { min: 18, fast: 26, critical: 40, criticalLow: 10 } // school-age 5–11y
  if (ageMonths < 192) return { min: 12, fast: 21, critical: 35, criticalLow: 8 } // adolescent 12–15y
  return null
}

/** Adult resp. rate: 12–20 /min. Pediatric: WHO IMCI fast-breathing thresholds by age. */
export function respiratoryRateBadge(
  rate: number | string | null | undefined,
  dateOfBirth?: string | null
): VitalBadge | null {
  const rr = parseNum(rate)
  if (rr === null) return null

  const t = respiratoryThresholds(ageInMonths(dateOfBirth))
  if (t) {
    if (rr >= t.critical) return badge('Critical', CRITICAL, true)
    if (rr >= t.fast) return badge('Fast breathing', ABNORMAL, true)
    if (rr >= t.min) return badge('Normal', NORMAL, false)
    if (rr >= t.criticalLow) return badge('Slow', ELEVATED, true)
    return badge('Critical', CRITICAL, true)
  }

  if (rr > 30) return badge('Critical', CRITICAL, true)
  if (rr > 20) return badge('Fast', ABNORMAL, true)
  if (rr >= 12) return badge('Normal', NORMAL, false)
  if (rr >= 8) return badge('Slow', ELEVATED, true)
  return badge('Critical', CRITICAL, true)
}

/** SpO₂: ≥95% normal for all ages (delivery-room targets aside, not applicable at triage). */
export function oxygenSaturationBadge(
  spo2: number | string | null | undefined
): VitalBadge | null {
  const sat = parseNum(spo2)
  if (sat === null) return null

  if (sat < 90) return badge('Critical', CRITICAL, true)
  if (sat < 95) return badge('Low', ABNORMAL, true)
  return badge('Normal', NORMAL, false)
}

type BpThresholds = {
  criticalLow: number
  low: number
  normalMax: number
  high: number
  criticalHigh: number
}

/** AHA/PALS/ATLS hypotension formula (SBP < 70 + 2×age) for 1–<10y; fixed bands for neonate/infant. */
function systolicThresholds(ageMonths: number | null): BpThresholds | null {
  if (ageMonths === null) return null
  if (ageMonths < 1) return { criticalLow: 50, low: 60, normalMax: 90, high: 100, criticalHigh: 110 }
  if (ageMonths < 12) return { criticalLow: 60, low: 70, normalMax: 104, high: 110, criticalHigh: 120 }
  if (ageMonths < 120) {
    const ageYears = ageMonths / 12
    const low = 70 + 2 * ageYears
    const normalMax = 90 + 2 * ageYears
    return {
      criticalLow: Math.round(low - 15),
      low: Math.round(low),
      normalMax: Math.round(normalMax),
      high: Math.round(normalMax + 15),
      criticalHigh: Math.round(normalMax + 30),
    }
  }
  return null // ≥10 years: adult rules apply (matches the AHA/ATLS ">10y" cutoff)
}

/** Approximate age-scaled diastolic bands (no single validated simple formula, unlike systolic). */
function diastolicThresholds(ageMonths: number | null): Omit<BpThresholds, 'criticalLow'> | null {
  if (ageMonths === null) return null
  if (ageMonths < 1) return { low: 35, normalMax: 55, high: 60, criticalHigh: 70 }
  if (ageMonths < 12) return { low: 37, normalMax: 65, high: 70, criticalHigh: 80 }
  if (ageMonths < 120) {
    const ageYears = ageMonths / 12
    const low = 30 + 1.5 * ageYears
    const normalMax = 55 + 1.5 * ageYears
    return {
      low: Math.round(low),
      normalMax: Math.round(normalMax),
      high: Math.round(normalMax + 10),
      criticalHigh: Math.round(normalMax + 25),
    }
  }
  return null // ≥10 years: adult rules apply
}

export function systolicBpBadge(
  mmHg: number | string | null | undefined,
  dateOfBirth?: string | null
): VitalBadge | null {
  const sys = parseNum(mmHg)
  if (sys === null) return null

  const t = systolicThresholds(ageInMonths(dateOfBirth))
  if (t) {
    if (sys >= t.criticalHigh) return badge('Crisis', CRITICAL, true)
    if (sys >= t.high) return badge('High', ABNORMAL, true)
    if (sys > t.normalMax) return badge('Elevated', ELEVATED, true)
    if (sys >= t.low) return badge('Normal', NORMAL, false)
    if (sys >= t.criticalLow) return badge('Low', LOW, true)
    return badge('Hypotension', CRITICAL, true)
  }

  if (sys >= 180) return badge('Crisis', CRITICAL, true)
  if (sys >= 140) return badge('High', ABNORMAL, true)
  if (sys >= 120) return badge('Elevated', ELEVATED, true)
  if (sys >= 90) return badge('Normal', NORMAL, false)
  if (sys >= 80) return badge('Low', LOW, true)
  return badge('Hypotension', CRITICAL, true)
}

export function diastolicBpBadge(
  mmHg: number | string | null | undefined,
  dateOfBirth?: string | null
): VitalBadge | null {
  const dia = parseNum(mmHg)
  if (dia === null) return null

  const t = diastolicThresholds(ageInMonths(dateOfBirth))
  if (t) {
    if (dia >= t.criticalHigh) return badge('Crisis', CRITICAL, true)
    if (dia >= t.high) return badge('High', ABNORMAL, true)
    if (dia > t.normalMax) return badge('Elevated', ELEVATED, true)
    if (dia >= t.low) return badge('Normal', NORMAL, false)
    return badge('Low', LOW, true)
  }

  if (dia >= 110) return badge('Crisis', CRITICAL, true)
  if (dia >= 90) return badge('High', ABNORMAL, true)
  if (dia >= 80) return badge('Elevated', ELEVATED, true)
  if (dia >= 60) return badge('Normal', NORMAL, false)
  return badge('Low', LOW, true)
}

/** Random capillary glucose mmol/L */
export function bloodSugarBadge(
  mmol: number | string | null | undefined
): VitalBadge | null {
  const sugar = parseNum(mmol)
  if (sugar === null) return null

  if (sugar >= 11.1) return badge('Very high', CRITICAL, true)
  if (sugar >= 7.0) return badge('High', ABNORMAL, true)
  if (sugar > 5.5) return badge('Elevated', ELEVATED, true)
  if (sugar >= 3.9) return badge('Normal', NORMAL, false)
  if (sugar >= 3.0) return badge('Low', LOW, true)
  return badge('Hypoglycemia', CRITICAL, true)
}

/** Adult MUAC thresholds (cm) */
export function muacBadge(cm: number | string | null | undefined): VitalBadge | null {
  const muac = parseNum(cm)
  if (muac === null) return null

  if (muac < 11.5) return badge('SAM', CRITICAL, true)
  if (muac < 12.5) return badge('MAM', WARNING, true)
  return badge('Normal', NORMAL, false)
}

export function muacScoreBadge(score: string | null | undefined): VitalBadge | null {
  const s = String(score ?? '').trim()
  if (!s) return null
  if (s.startsWith('SAM')) return badge('SAM', CRITICAL, true)
  if (s.startsWith('MAM')) return badge('MAM', WARNING, true)
  if (s.startsWith('Normal')) return badge('Normal', NORMAL, false)
  return null
}

/** Waist circumference risk threshold ~102 cm */
export function abdominalCircumferenceBadge(
  cm: number | string | null | undefined
): VitalBadge | null {
  const abd = parseNum(cm)
  if (abd === null) return null

  if (abd >= 120) return badge('Very high', CRITICAL, true)
  if (abd >= 102) return badge('High risk', ABNORMAL, true)
  if (abd >= 94) return badge('Elevated', ELEVATED, true)
  return badge('Normal', NORMAL, false)
}

/** Pain scale 0–10 */
export function painScaleBadge(
  scale: number | string | null | undefined
): VitalBadge | null {
  const pain = parseNum(scale)
  if (pain === null) return null

  if (pain >= 7) return badge('Severe', CRITICAL, true)
  if (pain >= 4) return badge('Moderate', ABNORMAL, true)
  if (pain >= 1) return badge('Mild', ELEVATED, true)
  return badge('None', NORMAL, false)
}

export function bmiBadge(bmi: number | string | null | undefined): VitalBadge | null {
  const value = parseNum(bmi)
  if (value === null) return null

  if (value < 18.5) return badge('Underweight', WARNING, true)
  if (value < 25) return badge('Normal', NORMAL, false)
  if (value < 30) return badge('Overweight', ELEVATED, true)
  if (value < 35) return badge('Obese (I)', ABNORMAL, true)
  if (value < 40) return badge('Obese (II)', CRITICAL, true)
  return badge('Severely Obese', CRITICAL, true)
}

export type VitalSeverity = 'normal' | 'low' | 'elevated' | 'abnormal' | 'critical'

const SEVERITY_RANK: Record<VitalSeverity, number> = {
  normal: 0,
  low: 1,
  elevated: 2,
  abnormal: 3,
  critical: 4,
}

export type TriageVitalsInput = {
  temperature?: number | string | null
  pulse?: number | string | null
  respiratory_rate?: number | string | null
  oxygen_saturation?: number | string | null
  systolic_bp?: number | string | null
  diastolic_bp?: number | string | null
  blood_sugar?: number | string | null
  bmi?: number | string | null
  muac?: number | string | null
  muac_score?: string | null
  abdominal_circumference?: number | string | null
  pain_scale?: number | string | null
  weight?: number | string | null
  /** Used to select age-appropriate ranges for heart rate, respiration, and blood pressure. */
  date_of_birth?: string | null
}

export function severityFromBadge(badge: VitalBadge | null | undefined): VitalSeverity | null {
  if (!badge) return null
  if (!badge.abnormal) return 'normal'

  if (badge.color === CRITICAL.color) return 'critical'
  if (badge.color === ABNORMAL.color) return 'abnormal'
  if (badge.color === ELEVATED.color || badge.color === WARNING.color) return 'elevated'
  if (badge.color === LOW.color) return 'low'
  return 'abnormal'
}

export function collectVitalBadges(vitals: TriageVitalsInput): VitalBadge[] {
  return [
    temperatureBadge(vitals.temperature, vitals.date_of_birth),
    pulseBadge(vitals.pulse, vitals.date_of_birth),
    respiratoryRateBadge(vitals.respiratory_rate, vitals.date_of_birth),
    oxygenSaturationBadge(vitals.oxygen_saturation),
    systolicBpBadge(vitals.systolic_bp, vitals.date_of_birth),
    diastolicBpBadge(vitals.diastolic_bp, vitals.date_of_birth),
    bloodSugarBadge(vitals.blood_sugar),
    bmiBadge(vitals.bmi),
    muacBadge(vitals.muac),
    muacScoreBadge(vitals.muac_score),
    abdominalCircumferenceBadge(vitals.abdominal_circumference),
    painScaleBadge(vitals.pain_scale),
  ].filter((badge): badge is VitalBadge => badge !== null)
}

export function worstVitalSeverity(vitals: TriageVitalsInput): VitalSeverity | null {
  let worst: VitalSeverity | null = null

  for (const badge of collectVitalBadges(vitals)) {
    const severity = severityFromBadge(badge)
    if (!severity) continue
    if (worst === null || SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) {
      worst = severity
    }
  }

  return worst
}

export function accentColorForSeverity(severity: VitalSeverity | null): string | null {
  if (!severity || severity === 'normal') return null

  switch (severity) {
    case 'critical':
      return '#7f1d1d'
    case 'abnormal':
      return '#dc2626'
    case 'elevated':
      return '#d97706'
    case 'low':
      return '#2563eb'
    default:
      return null
  }
}

export function borderColorForSeverity(severity: VitalSeverity | null): string | null {
  if (!severity || severity === 'normal') return null

  switch (severity) {
    case 'critical':
      return '#fca5a5'
    case 'abnormal':
      return '#fecaca'
    case 'elevated':
      return '#fed7aa'
    case 'low':
      return '#bfdbfe'
    default:
      return null
  }
}

export function chipClassForSeverity(severity: VitalSeverity | null): string {
  if (!severity || severity === 'normal') return ''
  return `ph-vital-chip--${severity}`
}

export function vitalValueClassForSeverity(severity: VitalSeverity | null): string {
  switch (severity) {
    case 'critical':
      return 'text-red-800 dark:text-red-300'
    case 'abnormal':
      return 'text-red-600 dark:text-red-400'
    case 'elevated':
      return 'text-amber-700 dark:text-amber-300'
    case 'low':
      return 'text-blue-700 dark:text-blue-300'
    default:
      return ''
  }
}
