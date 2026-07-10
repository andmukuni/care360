export function parseJsonArrayField<T extends Record<string, unknown>>(
  initialText: string | null | undefined
): { entries: T[]; initialRaw: string } {
  const initialRaw = typeof initialText === 'string' ? initialText : ''
  if (!initialRaw) {
    return { entries: [], initialRaw: '' }
  }

  try {
    const parsed = JSON.parse(initialRaw)
    if (Array.isArray(parsed)) {
      return { entries: parsed as T[], initialRaw: '' }
    }
  } catch {
    // keep legacy free-text in initialRaw if not JSON
  }

  return { entries: [], initialRaw }
}

export function parseJsonObjectField<T extends Record<string, unknown>>(
  initialText: string | null | undefined
): { data: Partial<T>; initialRaw: string } {
  const initialRaw = typeof initialText === 'string' ? initialText : ''
  if (!initialRaw) {
    return { data: {}, initialRaw: '' }
  }

  try {
    const parsed = JSON.parse(initialRaw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Partial<T>, initialRaw: '' }
    }
  } catch {
    // keep legacy free-text in initialRaw if not JSON
  }

  return { data: {}, initialRaw }
}

export function serializeEntries<T>(entries: T[], initialRaw = ''): string {
  if (entries.length > 0) {
    return JSON.stringify(entries)
  }
  return initialRaw
}

export function serializeObject<T extends Record<string, unknown>>(
  data: Partial<T>,
  hasData: boolean,
  initialRaw = ''
): string {
  if (hasData) {
    return JSON.stringify(data)
  }
  return initialRaw
}

export const SYSTEM_EXAMINATION_OPTIONS = [
  'Other',
  'Endocrine system',
  'Systemic Symptoms',
  'Ear, Nose, and Throat',
  'Respiratory System',
  'Gastro-Intestinal System',
  'Cardiovascular System',
  'Genito-Urinary System',
  'Musculoskeletal System',
  'Integumentary system',
  'Nervous System',
] as const

export type SystemExaminationEntry = {
  system: string
  notes: string
}

export type PastMedicalHistoryData = {
  drug_history: string
  admission_history: string
  surgical_history: string
}

export type AllergyEntry = {
  allergy_type: string
  severity: string
  drug_type: string
}

export type ChronicConditionEntry = {
  type: string
  path: string
  condition: string
  date_diagnosed: string
  still_ongoing: boolean
  date_resolved: string
  certainty: string
  comments: string
}

export type DiagnosisEntry = {
  type: string
  icd11?: string
  level1?: string
  level2?: string
  level3?: string
  path: string
  certainty: string
  attendance: string
  comments: string
}

/** Human-readable label for provisional/final diagnosis JSON or legacy plain text. */
export function formatDiagnosisLabel(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim()
  if (value === '') return ''

  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    const matches = value.match(/^\[(.*)\]$/s)
    return matches ? matches[1].trim() : value
  }

  if (!Array.isArray(decoded)) return value

  return decoded
    .map((entry) => {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        return String(entry ?? '').trim()
      }

      const e = entry as Partial<DiagnosisEntry> & Record<string, unknown>
      let label = e.path
        ? String(e.path)
        : [e.level1, e.level2, e.level3]
            .filter((part) => Boolean(part))
            .map((part) => String(part))
            .join(' › ')

      const extras = [e.certainty, e.attendance]
        .filter((part) => Boolean(part))
        .map((part) => String(part))
        .join(', ')

      if (extras) {
        label = `${label} (${extras})`.trim()
      }

      return label || String(e.type ?? '').trim()
    })
    .filter((label) => label !== '')
    .join(' · ')
}

export type FamilyHistoryData = {
  family_history: string
  ncd_risk_factors: boolean | null
}

export type SocialHistoryData = {
  smokes: boolean | null
  drinks_alcohol: boolean | null
}

export type GeneralAssessmentData = {
  general_condition: string
  pallor: string
  edema: string
  clubbing: string
  jaundice: string
  cyanosis: string
}

const GENERAL_ASSESSMENT_MAP: Record<string, keyof GeneralAssessmentData> = {
  'General Condition': 'general_condition',
  Pallor: 'pallor',
  Edema: 'edema',
  Clubbing: 'clubbing',
  Jaundice: 'jaundice',
  Cyanosis: 'cyanosis',
}

export function parseGeneralAssessment(initialText: string | null | undefined): {
  form: GeneralAssessmentData
  initialRaw: string
} {
  const form: GeneralAssessmentData = {
    general_condition: '',
    pallor: '',
    edema: '',
    clubbing: '',
    jaundice: '',
    cyanosis: '',
  }
  const initialRaw = typeof initialText === 'string' ? initialText : ''

  if (typeof initialText === 'string' && initialText.includes(':')) {
    initialText.split(';').forEach((part) => {
      const [label, ...rest] = part.trim().split(':')
      if (!label || !rest.length) return
      const key = GENERAL_ASSESSMENT_MAP[label.trim()]
      if (key) form[key] = rest.join(':').trim()
    })
  }

  return { form, initialRaw }
}

export function serializeGeneralAssessment(
  form: GeneralAssessmentData,
  initialRaw = ''
): string {
  const hasData = Object.values(form).some((value) => !!value)
  if (!hasData) return initialRaw

  const parts: string[] = []
  if (form.general_condition) parts.push(`General Condition: ${form.general_condition}`)
  if (form.pallor) parts.push(`Pallor: ${form.pallor}`)
  if (form.edema) parts.push(`Edema: ${form.edema}`)
  if (form.clubbing) parts.push(`Clubbing: ${form.clubbing}`)
  if (form.jaundice) parts.push(`Jaundice: ${form.jaundice}`)
  if (form.cyanosis) parts.push(`Cyanosis: ${form.cyanosis}`)
  return parts.join('; ')
}

export function filterIcd11Library(library: string[], query: string, limit = 300): string[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return library.filter((item) => item.toLowerCase().includes(normalized)).slice(0, limit)
}
