import {
  deriveInterpretationForState,
  effectiveReferenceRange,
} from './lab_result_badges.js'

export type LabResultFormFieldDef = {
  key: string
  label: string
  type: string
  options: string[]
  placeholder: string | null
  required: boolean
}

export type LabResultFormMaps = {
  testFormKeyMap: Record<string, string>
  formRenderMap: Record<string, string>
  formLabelMap: Record<string, string>
  formFieldsMap: Record<string, LabResultFormFieldDef[]>
}

export type LabResultFormState = {
  formKey: string
  formType: string
  value: string
  range: string
  interp: string
  remarks: string
  text: string
  custom: Record<string, string>
  fbc: Record<string, string>
  stool: Record<string, string>
  urine_chem: Record<string, string>
  urine_micro: Record<string, string>
  urine_macro: Record<string, string>
  hvs: Record<string, string>
}

export const FORM_TYPE_LABELS: Record<string, string> = {
  quantitative: 'Quantitative result',
  rapid_test: 'Rapid test',
  reactive_test: 'Reactive test',
  fbc: 'Full blood count panel',
  stool_analysis: 'Stool analysis panel',
  urine_chemistry: 'Urine chemistry panel',
  urine_microscopy: 'Urine microscopy panel',
  urine_macroscopy: 'Urine macroscopy panel',
  hvs: 'High vaginal swab panel',
  koh: 'KOH preparation',
  custom: 'Custom form',
}

const FBC_LABELS: Record<string, string> = {
  wbc: 'WBC',
  lymph_abs: 'LYMPH',
  mid_abs: 'MID',
  gran_abs: 'GRAN',
  lymph_pct: 'LYMPH%',
  mid_pct: 'MID%',
  gran_pct: 'GRAN%',
  rbc: 'RBC',
  hgb: 'HGB',
  hct: 'HCT',
  mcv: 'MCV',
  mch: 'MCH',
  mchc: 'MCHC',
  rdw_cv: 'RDW-CV',
  rdw_sd: 'RDW-SD',
  plt: 'PLT',
  mpv: 'MPV',
  pdw: 'PDW',
  pct: 'PCT',
}

const FBC_UNITS: Record<string, string> = {
  wbc: '×10³/µL',
  lymph_abs: '×10³/µL',
  mid_abs: '×10³/µL',
  gran_abs: '×10³/µL',
  lymph_pct: '%',
  mid_pct: '%',
  gran_pct: '%',
  rbc: '×10⁶/µL',
  hgb: 'g/dL',
  hct: '%',
  mcv: 'fL',
  mch: 'pg',
  mchc: 'g/dL',
  rdw_cv: '%',
  rdw_sd: 'fL',
  plt: '×10³/µL',
  mpv: 'fL',
  pdw: '',
  pct: '%',
}

const STOOL_MACRO_LABELS: Record<string, string> = {
  con: 'CON',
  colour: 'COLOUR',
  odor: 'ODOR',
  mucus: 'MUCUS',
  undigested_food: 'UNDIGESTED FOOD',
  blood: 'BLOOD',
  macro_other: 'OTHER',
}

const STOOL_MICRO_LABELS: Record<string, string> = {
  pus_cells: 'PUS CELLS',
  rbcs: 'RBCs',
  epithelial_cells: 'EPITHELIAL CELLS',
  parasites: 'PARASITES',
  bacteria: 'BACTERIA',
  yeast_cells: 'YEAST CELLS',
  cellular_cast: 'CELLULAR CAST',
  other_cast: 'OTHER CAST',
  micro_others: 'OTHERS',
}

const URINE_CHEM_LABELS: Record<string, string> = {
  leucocyt: 'LEUCOCYT',
  nitrate: 'NITRATE',
  urobilinogen: 'UROBILINOGEN',
  protein: 'PROTEIN',
  ph: 'PH',
  blood: 'BLOOD',
  sg: 'SG',
  ketone: 'KETONE',
  bilirubin: 'BILIRUBIN',
  glucose: 'GLUCOSE',
}

const URINE_MICRO_LABELS: Record<string, string> = {
  pus_cells: 'PUS CELLS',
  rbcs: 'RBCs',
  epithelial_cells: 'EPITHELIAL CELLS',
  parasites: 'PARASITES',
  bacteria: 'BACTERIA',
  yeast_cells: 'YEAST CELLS',
  cellular_casts: 'CELLULAR CASTS',
  other_casts: 'OTHER CASTS',
  other: 'OTHER',
}

const HVS_LABELS: Record<string, string> = {
  pus: 'PUS',
  rbcs: 'RBCs',
  epithelial_cells: 'EPITHELIAL CELLS',
  parasites: 'PARASITES',
  yeast_cells: 'YEAST CELLS',
  other: 'OTHER',
}

export function emptyLabResultFormState(): LabResultFormState {
  return {
    formKey: '',
    formType: 'quantitative',
    value: '',
    range: '',
    interp: '',
    remarks: '',
    text: '',
    custom: {},
    fbc: emptyKeyedObject(Object.keys(FBC_LABELS)),
    stool: emptyKeyedObject([
      ...Object.keys(STOOL_MACRO_LABELS),
      ...Object.keys(STOOL_MICRO_LABELS),
    ]),
    urine_chem: emptyKeyedObject(Object.keys(URINE_CHEM_LABELS)),
    urine_micro: emptyKeyedObject(Object.keys(URINE_MICRO_LABELS)),
    urine_macro: { colour: '', turbidity: '' },
    hvs: emptyKeyedObject(Object.keys(HVS_LABELS)),
  }
}

function emptyKeyedObject(keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, '']))
}

export function deriveFormKey(testName: string, maps: LabResultFormMaps): string {
  const normalized = testName.trim().toUpperCase()
  return maps.testFormKeyMap[normalized] ?? 'quantitative'
}

export function resolveRenderType(formKey: string, maps: LabResultFormMaps): string {
  return maps.formRenderMap[formKey] ?? 'quantitative'
}

export function resolveFormTypeForTest(testName: string, maps: LabResultFormMaps): {
  formKey: string
  formType: string
  formLabel: string
} {
  const formKey = deriveFormKey(testName, maps)
  const formType = resolveRenderType(formKey, maps)
  const formLabel = maps.formLabelMap[formKey] ?? FORM_TYPE_LABELS[formType] ?? 'Quantitative result'
  return { formKey, formType, formLabel }
}

export function customFieldsForForm(
  formKey: string,
  maps: LabResultFormMaps
): LabResultFormFieldDef[] {
  return maps.formFieldsMap[formKey] ?? []
}

export function initializeFormStateForTest(
  testName: string,
  maps: LabResultFormMaps,
  existing?: {
    result_value?: string | null
    result_text?: string | null
    reference_range?: string | null
    interpretation?: string | null
    remarks?: string | null
  } | null
): LabResultFormState {
  const { formKey, formType } = resolveFormTypeForTest(testName, maps)
  const state = emptyLabResultFormState()
  state.formKey = formKey
  state.formType = formType

  if (!existing) {
    for (const field of customFieldsForForm(formKey, maps)) {
      state.custom[field.key] = ''
    }
    if (formType === 'quantitative') {
      state.range = effectiveReferenceRange(null, testName)
    }
    return state
  }

  state.value = existing.result_value ?? ''
  state.range = existing.reference_range ?? ''
  state.interp = existing.interpretation ?? ''
  state.remarks = existing.remarks ?? ''
  state.text = existing.result_text ?? ''

  if (formType === 'custom') {
    parseCustomFields(state, maps)
  } else if (formType === 'fbc') {
    parsePanelFields(state.fbc, existing.result_text, FBC_LABELS, FBC_UNITS)
  } else if (formType === 'stool_analysis') {
    parseStoolFields(state, existing.result_text)
  } else if (formType === 'urine_chemistry') {
    parsePanelFields(state.urine_chem, existing.result_text, URINE_CHEM_LABELS)
  } else if (formType === 'urine_microscopy') {
    parsePanelFields(state.urine_micro, existing.result_text, URINE_MICRO_LABELS)
  } else if (formType === 'hvs') {
    parsePanelFields(state.hvs, existing.result_text, HVS_LABELS)
  } else if (formType === 'urine_macroscopy') {
    parseUrineMacroFields(state, existing.result_text)
  }

  for (const field of customFieldsForForm(formKey, maps)) {
    if (!(field.key in state.custom)) state.custom[field.key] = ''
  }

  applyDefaultReferenceRange(state, testName)
  applyDerivedInterpretation(state, testName)

  return state
}

function applyDefaultReferenceRange(state: LabResultFormState, testName: string) {
  if (state.formType !== 'quantitative' || state.range.trim()) return
  state.range = effectiveReferenceRange(null, testName)
}

function applyDerivedInterpretation(state: LabResultFormState, testName: string) {
  if (state.interp.trim()) return
  const derived = deriveInterpretationForState(state.formType, state, testName)
  if (derived) state.interp = derived
}

function parseCustomFields(state: LabResultFormState, maps: LabResultFormMaps) {
  const fields = customFieldsForForm(state.formKey, maps)
  const lines = String(state.text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const match = fields.find((field) => line.startsWith(`${field.label}:`))
    if (match) {
      state.custom[match.key] = line.slice(match.label.length + 1).trim()
    }
  }
}

function parsePanelFields(
  target: Record<string, string>,
  resultText: string | null | undefined,
  labels: Record<string, string>,
  units?: Record<string, string>
) {
  const parts = splitResultText(resultText)
  for (const [key, label] of Object.entries(labels)) {
    const unit = units?.[key] ? ` ${units[key]}` : ''
    const match = parts.find((part) => part.toUpperCase().startsWith(`${label}:`))
    if (!match) continue
    let value = match.slice(label.length + 1).trim()
    if (unit && value.endsWith(unit.trim())) {
      value = value.slice(0, -unit.trim().length).trim()
    }
    target[key] = value
  }
}

function parseStoolFields(state: LabResultFormState, resultText: string | null | undefined) {
  const parts = splitResultText(resultText)
  for (const part of parts) {
    const macro = part.match(/^Macroscopy — (.+)$/i)
    if (macro) {
      parseLabelValuePairs(macro[1], STOOL_MACRO_LABELS, state.stool)
      continue
    }
    const micro = part.match(/^Microscopy — (.+)$/i)
    if (micro) {
      parseLabelValuePairs(micro[1], STOOL_MICRO_LABELS, state.stool)
    }
  }
}

function parseUrineMacroFields(state: LabResultFormState, resultText: string | null | undefined) {
  for (const part of splitResultText(resultText)) {
    if (part.toUpperCase().startsWith('COLOUR:')) {
      state.urine_macro.colour = part.slice(7).trim()
    }
    if (part.toUpperCase().startsWith('TURBIDITY:')) {
      state.urine_macro.turbidity = part.slice(10).trim()
    }
  }
}

function parseLabelValuePairs(
  chunk: string,
  labels: Record<string, string>,
  target: Record<string, string>
) {
  const pairs = chunk.split(',').map((entry) => entry.trim())
  for (const pair of pairs) {
    const [label, ...rest] = pair.split(':')
    if (!label || !rest.length) continue
    const key = Object.entries(labels).find(([, value]) => value === label.trim())?.[0]
    if (key) target[key] = rest.join(':').trim()
  }
}

function splitResultText(resultText: string | null | undefined): string[] {
  if (!resultText) return []
  return resultText
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
}

function hasPanelValues(values: Record<string, string>) {
  return Object.values(values).some((value) => String(value).trim() !== '')
}

export function serializeLabResultFormState(
  state: LabResultFormState,
  maps: LabResultFormMaps
): {
  result_value: string | null
  result_text: string | null
  reference_range: string | null
  interpretation: string | null
  remarks: string | null
} | null {
  const output = {
    result_value: state.value?.trim() || null,
    result_text: state.text?.trim() || null,
    reference_range: state.range?.trim() || null,
    interpretation: state.interp?.trim() || null,
    remarks: state.remarks?.trim() || null,
  }

  if (state.formType === 'custom') {
    const fields = customFieldsForForm(state.formKey, maps)
    const lines: string[] = []
    for (const field of fields) {
      const value = String(state.custom[field.key] ?? '').trim()
      if (field.required && !value) return null
      if (value) lines.push(`${field.label}: ${value}`)
    }
    if (!lines.length) return null
    output.result_value = maps.formLabelMap[state.formKey] ?? 'Custom result'
    output.result_text = lines.join('\n')
    output.reference_range = null
    output.interpretation = output.interpretation
  } else if (state.formType === 'urine_macroscopy') {
    const parts: string[] = []
    if (state.urine_macro.colour) parts.push(`COLOUR: ${state.urine_macro.colour}`)
    if (state.urine_macro.turbidity) parts.push(`TURBIDITY: ${state.urine_macro.turbidity}`)
    if (!parts.length) return null
    output.result_value = 'Urine Macroscopy'
    output.result_text = parts.join(' | ')
    output.reference_range = null
  } else if (state.formType === 'koh') {
    if (!output.result_value) return null
    output.reference_range = null
  } else if (state.formType === 'hvs') {
    if (!hasPanelValues(state.hvs)) return null
    output.result_value = 'HVS'
    output.result_text = serializePanel(state.hvs, HVS_LABELS)
    output.reference_range = null
  } else if (state.formType === 'urine_microscopy') {
    if (!hasPanelValues(state.urine_micro)) return null
    output.result_value = 'Urine Microscopy'
    output.result_text = serializePanel(state.urine_micro, URINE_MICRO_LABELS)
    output.reference_range = null
  } else if (state.formType === 'urine_chemistry') {
    if (!hasPanelValues(state.urine_chem)) return null
    output.result_value = 'Urine Chemistry'
    output.result_text = serializePanel(state.urine_chem, URINE_CHEM_LABELS)
    output.reference_range = null
  } else if (state.formType === 'stool_analysis') {
    if (!hasPanelValues(state.stool)) return null
    const macro = serializeLabelValuePairs(state.stool, STOOL_MACRO_LABELS)
    const micro = serializeLabelValuePairs(state.stool, STOOL_MICRO_LABELS)
    const parts: string[] = []
    if (macro.length) parts.push(`Macroscopy — ${macro.join(', ')}`)
    if (micro.length) parts.push(`Microscopy — ${micro.join(', ')}`)
    output.result_value = 'Stool Analysis'
    output.result_text = parts.join(' | ')
    output.reference_range = null
  } else if (state.formType === 'fbc') {
    if (!hasPanelValues(state.fbc)) return null
    const lines = Object.entries(FBC_LABELS)
      .filter(([key]) => String(state.fbc[key] ?? '').trim() !== '')
      .map(([key, label]) => {
        const unit = FBC_UNITS[key] ? ` ${FBC_UNITS[key]}` : ''
        return `${label}: ${state.fbc[key]}${unit}`.trimEnd()
      })
    output.result_value = 'FBC Panel'
    output.result_text = lines.join(' | ')
    output.reference_range = null
  }

  const hasAny =
    output.result_value ||
    output.result_text ||
    output.reference_range ||
    output.interpretation ||
    output.remarks

  return hasAny ? output : null
}

function serializePanel(values: Record<string, string>, labels: Record<string, string>) {
  return Object.entries(labels)
    .filter(([key]) => String(values[key] ?? '').trim() !== '')
    .map(([key, label]) => `${label}: ${values[key]}`)
    .join(' | ')
}

function serializeLabelValuePairs(values: Record<string, string>, labels: Record<string, string>) {
  return Object.entries(labels)
    .filter(([key]) => String(values[key] ?? '').trim() !== '')
    .map(([key, label]) => `${label}: ${values[key]}`)
}

export const FBC_FIELD_GROUPS = {
  absolute: ['wbc', 'lymph_abs', 'mid_abs', 'gran_abs', 'rbc', 'plt'] as const,
  differentials: ['lymph_pct', 'mid_pct', 'gran_pct'] as const,
  redCell: ['hgb', 'hct', 'mcv', 'mch', 'mchc', 'rdw_cv', 'rdw_sd'] as const,
  platelet: ['mpv', 'pdw', 'pct'] as const,
}

export const PANEL_FIELD_GROUPS = {
  stool_macro: Object.keys(STOOL_MACRO_LABELS),
  stool_micro: Object.keys(STOOL_MICRO_LABELS),
  urine_chem: Object.keys(URINE_CHEM_LABELS),
  urine_micro: Object.keys(URINE_MICRO_LABELS),
  hvs: Object.keys(HVS_LABELS),
}

export const PANEL_LABELS = {
  fbc: FBC_LABELS,
  fbc_units: FBC_UNITS,
  stool_macro: STOOL_MACRO_LABELS,
  stool_micro: STOOL_MICRO_LABELS,
  urine_chem: URINE_CHEM_LABELS,
  urine_micro: URINE_MICRO_LABELS,
  hvs: HVS_LABELS,
}
