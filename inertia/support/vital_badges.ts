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

/** Normal adult oral/axillary range: 36.0–37.4 °C */
const TEMP_NORMAL_MIN = 36.0
const TEMP_NORMAL_MAX = 37.4

export function temperatureBadge(
  celsius: number | string | null | undefined
): VitalBadge | null {
  const temp = parseNum(celsius)
  if (temp === null) return null

  if (temp >= 39) return badge('High fever', CRITICAL, true)
  if (temp >= 38) return badge('Fever', ABNORMAL, true)
  if (temp > TEMP_NORMAL_MAX) return badge('Elevated', ELEVATED, true)
  if (temp >= TEMP_NORMAL_MIN) return badge('Normal', NORMAL, false)
  if (temp >= 35) return badge('Low', LOW, true)
  if (temp >= 32) return badge('Hypothermia', WARNING, true)
  return badge('Severe hypothermia', CRITICAL, true)
}

/** Adult resting pulse: 60–100 bpm */
export function pulseBadge(bpm: number | string | null | undefined): VitalBadge | null {
  const pulse = parseNum(bpm)
  if (pulse === null) return null

  if (pulse > 120) return badge('Tachycardia', CRITICAL, true)
  if (pulse > 100) return badge('Fast', ABNORMAL, true)
  if (pulse >= 60) return badge('Normal', NORMAL, false)
  if (pulse >= 50) return badge('Slow', ELEVATED, true)
  if (pulse >= 40) return badge('Bradycardia', ABNORMAL, true)
  return badge('Critical', CRITICAL, true)
}

/** Adult resp. rate: 12–20 /min */
export function respiratoryRateBadge(
  rate: number | string | null | undefined
): VitalBadge | null {
  const rr = parseNum(rate)
  if (rr === null) return null

  if (rr > 30) return badge('Critical', CRITICAL, true)
  if (rr > 20) return badge('Fast', ABNORMAL, true)
  if (rr >= 12) return badge('Normal', NORMAL, false)
  if (rr >= 8) return badge('Slow', ELEVATED, true)
  return badge('Critical', CRITICAL, true)
}

/** SpO₂: ≥95% normal */
export function oxygenSaturationBadge(
  spo2: number | string | null | undefined
): VitalBadge | null {
  const sat = parseNum(spo2)
  if (sat === null) return null

  if (sat < 90) return badge('Critical', CRITICAL, true)
  if (sat < 95) return badge('Low', ABNORMAL, true)
  return badge('Normal', NORMAL, false)
}

export function systolicBpBadge(
  mmHg: number | string | null | undefined
): VitalBadge | null {
  const sys = parseNum(mmHg)
  if (sys === null) return null

  if (sys >= 180) return badge('Crisis', CRITICAL, true)
  if (sys >= 140) return badge('High', ABNORMAL, true)
  if (sys >= 120) return badge('Elevated', ELEVATED, true)
  if (sys >= 90) return badge('Normal', NORMAL, false)
  if (sys >= 80) return badge('Low', LOW, true)
  return badge('Hypotension', CRITICAL, true)
}

export function diastolicBpBadge(
  mmHg: number | string | null | undefined
): VitalBadge | null {
  const dia = parseNum(mmHg)
  if (dia === null) return null

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
    temperatureBadge(vitals.temperature),
    pulseBadge(vitals.pulse),
    respiratoryRateBadge(vitals.respiratory_rate),
    oxygenSaturationBadge(vitals.oxygen_saturation),
    systolicBpBadge(vitals.systolic_bp),
    diastolicBpBadge(vitals.diastolic_bp),
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
