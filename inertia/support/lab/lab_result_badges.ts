import type { VitalBadge } from '~/support/vital_badges'

const NORMAL = { bg: '#dcfce7', color: '#166534' }
const ELEVATED = { bg: '#ffedd5', color: '#9a3412' }
const ABNORMAL = { bg: '#fee2e2', color: '#991b1b' }
const CRITICAL = { bg: '#fecaca', color: '#7f1d1d' }
const LOW = { bg: '#dbeafe', color: '#1e40af' }
const WARNING = { bg: '#fef3c7', color: '#92400e' }
const NEUTRAL = { bg: '#f5f5f5', color: '#525252' }

function badge(
  label: string,
  palette: { bg: string; color: string },
  abnormal: boolean
): VitalBadge {
  return { label, ...palette, abnormal }
}

function parseNum(value: number | string | null | undefined): number | null {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isNaN(n) ? null : n
}

export type ReferenceBounds = {
  min: number | null
  max: number | null
}

export function parseReferenceBounds(range: string | null | undefined): ReferenceBounds | null {
  const raw = String(range ?? '').trim()
  if (!raw) return null

  const lessThan = raw.match(/^<\s*([\d.]+)/)
  if (lessThan) {
    return { min: null, max: parseFloat(lessThan[1]) }
  }

  const greaterThan = raw.match(/^>\s*([\d.]+)/)
  if (greaterThan) {
    return { min: parseFloat(greaterThan[1]), max: null }
  }

  const between = raw.match(/([\d.]+)\s*(?:–|-|to)\s*([\d.]+)/i)
  if (between) {
    return { min: parseFloat(between[1]), max: parseFloat(between[2]) }
  }

  const bare = raw.match(/^([\d.]+)\s*$/)
  if (bare) {
    const max = parseFloat(bare[1])
    return { min: 0, max }
  }

  return null
}

/** Standard reference ranges keyed by uppercased test name (from BARCODES lab workbench). */
export const STANDARD_REFERENCE_RANGES: Record<string, string> = {
  BIL: '0.2 – 1.2 mg/dL',
  'T. BIL': '0.2 – 1.2 mg/dL',
  'TOTAL BILIRUBIN': '0.2 – 1.2 mg/dL',
  'DIRECT BIL': '0.0 – 0.3 mg/dL',
  'D. BIL': '0.0 – 0.3 mg/dL',
  LDH: '140 – 280 U/L',
  UREA: '7 – 20 mg/dL',
  BUN: '7 – 20 mg/dL',
  CREA: '0.5 – 1.2 mg/dL',
  CREATININE: '0.5 – 1.2 mg/dL',
  ALBUMIN: '3.5 – 5.0 g/dL',
  'Α-AMYLASE': '30 – 110 U/L',
  AMYLASE: '30 – 110 U/L',
  CRP: '< 10 mg/L',
  'C-REACTIVE PROTEIN': '< 10 mg/L',
  ALT: '7 – 56 U/L',
  SGPT: '7 – 56 U/L',
  AST: '10 – 40 U/L',
  SGOT: '10 – 40 U/L',
  'CK-MB': '0 – 25 U/L',
  'T. PROT': '6.0 – 8.3 g/dL',
  'TOTAL PROTEIN': '6.0 – 8.3 g/dL',
  'URIC ACID': '3.5 – 7.2 mg/dL',
  GLUCOSE: '70 – 100 mg/dL',
  FBS: '70 – 100 mg/dL',
  RBS: '70 – 140 mg/dL',
  'T. CHOL': '< 200 mg/dL',
  'TOTAL CHOLESTEROL': '< 200 mg/dL',
  CHOLESTEROL: '< 200 mg/dL',
  HB: '12.0 – 17.5 g/dL',
  HAEMOGLOBIN: '12.0 – 17.5 g/dL',
  HEMOGLOBIN: '12.0 – 17.5 g/dL',
  ESR: '0 – 20 mm/hr',
  'NA+': '136 – 145 mEq/L',
  SODIUM: '136 – 145 mEq/L',
  'K+': '3.5 – 5.1 mEq/L',
  POTASSIUM: '3.5 – 5.1 mEq/L',
  'CL-': '98 – 106 mEq/L',
  CHLORIDE: '98 – 106 mEq/L',
}

export const FBC_REFERENCE_RANGES: Record<string, [number, number]> = {
  wbc: [4.0, 11.0],
  lymph_abs: [1.0, 4.0],
  mid_abs: [0.1, 1.5],
  gran_abs: [2.0, 7.0],
  rbc: [4.0, 5.5],
  plt: [100, 300],
  lymph_pct: [20.0, 40.0],
  mid_pct: [3.0, 15.0],
  gran_pct: [50.0, 70.0],
  hgb: [12.0, 16.0],
  hct: [40.0, 54.0],
  mcv: [80.0, 100.0],
  mch: [27.0, 34.0],
  mchc: [32.0, 36.0],
  rdw_cv: [11.0, 16.0],
  rdw_sd: [35.0, 56.0],
  mpv: [6.5, 12.0],
  pdw: [15.0, 17.0],
  pct: [0.108, 0.282],
}

export function effectiveReferenceRange(
  enteredRange: string | null | undefined,
  testName: string | null | undefined
): string {
  const entered = String(enteredRange ?? '').trim()
  if (entered) return entered
  const key = String(testName ?? '').trim().toUpperCase()
  return STANDARD_REFERENCE_RANGES[key] ?? ''
}

export type LabInterpretation = 'normal' | 'abnormal' | 'critical' | 'inconclusive' | ''

export function deriveInterpretationFromValue(
  value: string | null | undefined,
  referenceRange: string | null | undefined,
  testName?: string | null
): LabInterpretation | null {
  const num = parseNum(value)
  if (num === null) return null

  const bounds = parseReferenceBounds(
    effectiveReferenceRange(referenceRange, testName ?? null)
  )
  if (!bounds) return null

  const { min, max } = bounds

  if (min !== null && max !== null) {
    if (num >= min && num <= max) return 'normal'
    return 'abnormal'
  }

  if (max !== null) {
    if (num <= max) return 'normal'
    return 'abnormal'
  }

  if (min !== null) {
    if (num >= min) return 'normal'
    return 'abnormal'
  }

  return null
}

export function deriveInterpretationFromSelection(
  formType: string,
  value: string | null | undefined
): LabInterpretation | null {
  const v = String(value ?? '').trim()
  if (!v) return null

  if (formType === 'rapid_test') {
    if (v === 'Negative') return 'normal'
    if (v === 'Positive') return 'abnormal'
  }
  if (formType === 'reactive_test') {
    if (v === 'Non-Reactive') return 'normal'
    if (v === 'Reactive') return 'abnormal'
  }
  if (formType === 'koh') {
    if (v === 'No Yeast Seen') return 'normal'
    if (v === 'Yeast Seen') return 'abnormal'
  }

  return null
}

export function interpretationBadge(
  interpretation: string | null | undefined
): VitalBadge | null {
  const value = String(interpretation ?? '').trim().toLowerCase()
  if (!value) return null

  switch (value) {
    case 'normal':
      return badge('Normal', NORMAL, false)
    case 'abnormal':
      return badge('Abnormal', ABNORMAL, true)
    case 'critical':
      return badge('Critical', CRITICAL, true)
    case 'inconclusive':
      return badge('Inconclusive', WARNING, true)
    default:
      return null
  }
}

export function quantitativeValueBadge(
  value: string | null | undefined,
  referenceRange: string | null | undefined,
  testName?: string | null
): VitalBadge | null {
  const num = parseNum(value)
  if (num === null) return null

  const bounds = parseReferenceBounds(
    effectiveReferenceRange(referenceRange, testName ?? null)
  )
  if (!bounds) return null

  const { min, max } = bounds
  if (min !== null && max !== null) {
    if (num < min) return badge('Low', LOW, true)
    if (num > max) return badge('High', ABNORMAL, true)
    return badge('Normal', NORMAL, false)
  }

  if (max !== null) {
    if (num >= max) return badge('High', ABNORMAL, true)
    return badge('Normal', NORMAL, false)
  }

  if (min !== null) {
    if (num <= min) return badge('Low', LOW, true)
    return badge('Normal', NORMAL, false)
  }

  return null
}

export function fbcFieldBadge(
  key: string,
  value: string | null | undefined
): VitalBadge | null {
  const num = parseNum(value)
  if (num === null || num === 0) return null

  const range = FBC_REFERENCE_RANGES[key]
  if (!range) return null

  if (num < range[0]) return badge('Low', LOW, true)
  if (num > range[1]) return badge('High', ABNORMAL, true)
  return badge('Normal', NORMAL, false)
}

export function rapidTestBadge(value: string | null | undefined): VitalBadge | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (v === 'Negative') return badge('Negative', NORMAL, false)
  if (v === 'Positive') return badge('Positive', ABNORMAL, true)
  return null
}

export function reactiveTestBadge(value: string | null | undefined): VitalBadge | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (v === 'Non-Reactive') return badge('Non-Reactive', NORMAL, false)
  if (v === 'Reactive') return badge('Reactive', ABNORMAL, true)
  return null
}

export function kohBadge(value: string | null | undefined): VitalBadge | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (v === 'No Yeast Seen') return badge('No Yeast Seen', NORMAL, false)
  if (v === 'Yeast Seen') return badge('Yeast Seen', ABNORMAL, true)
  return null
}

export function labItemStatusBadge(
  status: string | null | undefined,
  interpretation?: string | null
): VitalBadge | null {
  const normalized = String(status ?? '').trim().toLowerCase()
  const interpBadge = interpretationBadge(interpretation)

  if (interpBadge && interpBadge.abnormal) {
    return interpBadge
  }

  if (normalized === 'resulted' || normalized === 'completed') {
    return badge('Resulted', NORMAL, false)
  }
  if (normalized === 'pending') {
    return badge('Pending', NEUTRAL, false)
  }
  if (normalized) {
    return badge(
      normalized.charAt(0).toUpperCase() + normalized.slice(1).replaceAll('_', ' '),
      NEUTRAL,
      false
    )
  }

  return null
}

export function resultFieldBadge(
  formType: string,
  state: {
    value?: string
    range?: string
    interp?: string
    fbc?: Record<string, string>
    stool?: Record<string, string>
    urine_chem?: Record<string, string>
    urine_micro?: Record<string, string>
    urine_macro?: Record<string, string>
    hvs?: Record<string, string>
    custom?: Record<string, string>
  },
  options?: { testName?: string | null; fbcKey?: string; fieldKey?: string }
): VitalBadge | null {
  if (formType === 'quantitative') {
    return (
      quantitativeValueBadge(state.value, state.range, options?.testName) ??
      interpretationBadge(state.interp)
    )
  }
  if (formType === 'rapid_test') return rapidTestBadge(state.value)
  if (formType === 'reactive_test') return reactiveTestBadge(state.value)
  if (formType === 'koh') return kohBadge(state.value)
  if (formType === 'fbc' && options?.fbcKey) {
    return fbcFieldBadge(options.fbcKey, state.fbc?.[options.fbcKey])
  }
  if (options?.fieldKey) {
    return panelTextFieldBadge(formType, options.fieldKey, panelFieldValue(formType, state, options.fieldKey))
  }
  return interpretationBadge(state.interp)
}

// --- Panel text finding classifiers ---

export const NORMAL_FINDING_TOKENS = [
  'negative',
  'nil',
  'absent',
  'none',
  'normal',
  'not detected',
  'non-reactive',
  'no yeast seen',
  'clear',
  'formed',
  'brown',
  'pale yellow',
  'yellow',
  'colourless',
  'colorless',
  'slightly turbid',
  'few',
  'normal flora',
  '0',
  '0-2',
  '0–2',
]

export const ABNORMAL_FINDING_TOKENS = [
  'positive',
  'present',
  'reactive',
  'yeast seen',
  'trace',
  'blood',
  'many',
  'increased',
  'turbid',
  'very turbid',
  'watery',
  'offensive',
  'red',
  'pink',
  'amber',
  'orange',
  'parasite',
  'giardia',
  'trichomonas',
  'candida',
  'clue cells',
]

const URINE_MACRO_COLOUR_NORMAL = new Set([
  'pale yellow',
  'yellow',
  'dark yellow',
  'colourless',
  'colorless',
])

const URINE_MACRO_COLOUR_ABNORMAL = new Set(['red', 'pink', 'brown', 'amber', 'orange', 'other'])

const URINE_MACRO_TURBIDITY_NORMAL = new Set(['clear', 'slightly turbid'])
const URINE_MACRO_TURBIDITY_ABNORMAL = new Set(['turbid', 'very turbid'])

function normalizeFinding(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function containsPlusSign(value: string): boolean {
  return /\+/.test(value)
}

export type PanelFieldSeverity = 'normal' | 'abnormal' | 'elevated' | null

export function classifyTextFinding(value: string | null | undefined): PanelFieldSeverity {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const normalized = normalizeFinding(raw)

  if (containsPlusSign(normalized)) {
    if (normalized.includes('+++')) return 'abnormal'
    return 'elevated'
  }

  for (const token of ABNORMAL_FINDING_TOKENS) {
    if (normalized.includes(token)) return 'abnormal'
  }

  for (const token of NORMAL_FINDING_TOKENS) {
    if (normalized === token || normalized.startsWith(`${token} `) || normalized.includes(token)) {
      return 'normal'
    }
  }

  return null
}

function severityToBadge(severity: PanelFieldSeverity, value: string): VitalBadge | null {
  if (!severity) return null
  if (severity === 'normal') return badge('Normal', NORMAL, false)
  if (severity === 'elevated') return badge('Elevated', ELEVATED, true)
  return badge('Abnormal', ABNORMAL, true)
}

function urineMacroColourBadge(value: string): VitalBadge | null {
  const normalized = normalizeFinding(value)
  if (!normalized) return null
  if (URINE_MACRO_COLOUR_NORMAL.has(normalized)) return badge('Normal', NORMAL, false)
  if (URINE_MACRO_COLOUR_ABNORMAL.has(normalized)) return badge('Abnormal', ABNORMAL, true)
  return classifyTextFinding(value) ? severityToBadge(classifyTextFinding(value), value) : null
}

function urineMacroTurbidityBadge(value: string): VitalBadge | null {
  const normalized = normalizeFinding(value)
  if (!normalized) return null
  if (URINE_MACRO_TURBIDITY_NORMAL.has(normalized)) return badge('Normal', NORMAL, false)
  if (URINE_MACRO_TURBIDITY_ABNORMAL.has(normalized)) return badge('Turbid', ABNORMAL, true)
  return classifyTextFinding(value) ? severityToBadge(classifyTextFinding(value), value) : null
}

export type LabResultPanelState = {
  value?: string
  range?: string
  interp?: string
  fbc?: Record<string, string>
  stool?: Record<string, string>
  urine_chem?: Record<string, string>
  urine_micro?: Record<string, string>
  urine_macro?: Record<string, string>
  hvs?: Record<string, string>
  custom?: Record<string, string>
}

function panelFieldValue(
  formType: string,
  state: LabResultPanelState,
  fieldKey: string
): string {
  if (formType === 'stool_analysis') return state.stool?.[fieldKey] ?? ''
  if (formType === 'urine_chemistry') return state.urine_chem?.[fieldKey] ?? ''
  if (formType === 'urine_microscopy') return state.urine_micro?.[fieldKey] ?? ''
  if (formType === 'hvs') return state.hvs?.[fieldKey] ?? ''
  if (formType === 'urine_macroscopy') return state.urine_macro?.[fieldKey] ?? ''
  if (formType === 'custom') return state.custom?.[fieldKey] ?? ''
  return ''
}

function panelFieldKeys(formType: string, state: LabResultPanelState): string[] {
  if (formType === 'stool_analysis') return Object.keys(state.stool ?? {})
  if (formType === 'urine_chemistry') return Object.keys(state.urine_chem ?? {})
  if (formType === 'urine_microscopy') return Object.keys(state.urine_micro ?? {})
  if (formType === 'hvs') return Object.keys(state.hvs ?? {})
  if (formType === 'urine_macroscopy') return Object.keys(state.urine_macro ?? {})
  if (formType === 'custom') return Object.keys(state.custom ?? {})
  if (formType === 'fbc') return Object.keys(state.fbc ?? {})
  return []
}

export function panelTextFieldBadge(
  formType: string,
  fieldKey: string,
  value: string | null | undefined
): VitalBadge | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  if (formType === 'urine_macroscopy') {
    if (fieldKey === 'colour') return urineMacroColourBadge(raw)
    if (fieldKey === 'turbidity') return urineMacroTurbidityBadge(raw)
  }

  const severity = classifyTextFinding(raw)
  return severityToBadge(severity, raw)
}

export function customFieldBadge(
  fieldType: string,
  value: string | null | undefined
): VitalBadge | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (fieldType === 'number') {
    const num = parseNum(raw)
    if (num === null) return null
    return badge('Entered', NEUTRAL, false)
  }
  return panelTextFieldBadge('custom', 'value', raw) ?? badge('Entered', NEUTRAL, false)
}

export function deriveInterpretationFromFbc(
  fbc: Record<string, string> | undefined
): LabInterpretation | null {
  if (!fbc) return null

  let hasValue = false
  let hasAbnormal = false

  for (const [key, value] of Object.entries(fbc)) {
    if (!String(value ?? '').trim()) continue
    hasValue = true
    const fieldBadge = fbcFieldBadge(key, value)
    if (fieldBadge?.abnormal) hasAbnormal = true
  }

  if (!hasValue) return null
  return hasAbnormal ? 'abnormal' : 'normal'
}

export function deriveInterpretationFromPanel(
  formType: string,
  state: LabResultPanelState
): LabInterpretation | null {
  if (formType === 'fbc') {
    return deriveInterpretationFromFbc(state.fbc)
  }

  if (formType === 'urine_macroscopy') {
    const colour = state.urine_macro?.colour ?? ''
    const turbidity = state.urine_macro?.turbidity ?? ''
    if (!colour.trim() && !turbidity.trim()) return null

    const badges = [
      urineMacroColourBadge(colour),
      urineMacroTurbidityBadge(turbidity),
    ].filter((b): b is VitalBadge => b !== null)

    if (!badges.length) return null
    if (badges.some((b) => b.abnormal)) return 'abnormal'
    return 'normal'
  }

  const keys = panelFieldKeys(formType, state)
  let hasValue = false
  let hasAbnormal = false
  let hasNormal = false

  for (const key of keys) {
    const value = panelFieldValue(formType, state, key)
    if (!String(value).trim()) continue
    hasValue = true
    const fieldBadge = panelTextFieldBadge(formType, key, value)
    if (fieldBadge?.abnormal) hasAbnormal = true
    if (fieldBadge && !fieldBadge.abnormal) hasNormal = true
  }

  if (!hasValue) return null
  if (hasAbnormal) return 'abnormal'
  if (hasNormal) return 'normal'
  return null
}

export function deriveInterpretationForState(
  formType: string,
  state: LabResultPanelState,
  testName?: string | null
): LabInterpretation | null {
  if (formType === 'quantitative') {
    return deriveInterpretationFromValue(state.value, state.range, testName)
  }
  if (formType === 'rapid_test' || formType === 'reactive_test' || formType === 'koh') {
    return deriveInterpretationFromSelection(formType, state.value)
  }
  if (
    formType === 'fbc' ||
    formType === 'stool_analysis' ||
    formType === 'urine_chemistry' ||
    formType === 'urine_microscopy' ||
    formType === 'urine_macroscopy' ||
    formType === 'hvs' ||
    formType === 'custom'
  ) {
    return deriveInterpretationFromPanel(formType, state)
  }
  return null
}

export function formSummaryBadge(
  formType: string,
  state: LabResultPanelState,
  testName?: string | null
): VitalBadge | null {
  const interpBadge = interpretationBadge(state.interp)
  if (interpBadge) return interpBadge

  if (formType === 'quantitative') {
    return (
      quantitativeValueBadge(state.value, state.range, testName) ??
      null
    )
  }
  if (formType === 'rapid_test') return rapidTestBadge(state.value)
  if (formType === 'reactive_test') return reactiveTestBadge(state.value)
  if (formType === 'koh') return kohBadge(state.value)

  if (formType === 'fbc') {
    for (const [key, value] of Object.entries(state.fbc ?? {})) {
      const fieldBadge = fbcFieldBadge(key, value)
      if (fieldBadge?.abnormal) return fieldBadge
    }
    const hasAny = Object.values(state.fbc ?? {}).some((v) => String(v).trim())
    return hasAny ? badge('Normal', NORMAL, false) : null
  }

  const panelTypes = [
    'stool_analysis',
    'urine_chemistry',
    'urine_microscopy',
    'urine_macroscopy',
    'hvs',
    'custom',
  ]
  if (panelTypes.includes(formType)) {
    let worst: VitalBadge | null = null
    for (const key of panelFieldKeys(formType, state)) {
      const value = panelFieldValue(formType, state, key)
      const fieldBadge =
        formType === 'custom'
          ? customFieldBadge('text', value)
          : panelTextFieldBadge(formType, key, value)
      if (fieldBadge?.abnormal) return fieldBadge
      if (fieldBadge && !worst) worst = fieldBadge
    }
    return worst
  }

  return null
}
