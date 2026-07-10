import {
  parseJsonArrayField,
  type DiagnosisEntry,
} from './screening_json_fields.js'

export const PRESUMPTIVE_TB_RESPIRATORY_SYMPTOMS = [
  'cough',
  'blood_stained_sputum',
  'shortness_of_breath',
  'chest_pain',
] as const

export function hasPresumptiveTbIndicators(
  tbSymptoms: string[],
  constitutionalSymptoms: string
): boolean {
  return tbSymptoms.length > 0 || constitutionalSymptoms.trim() !== ''
}

export function resolvePresumptiveTbLevel3(tbSymptoms: string[]): string {
  const hasRespiratory = tbSymptoms.some((symptom) =>
    (PRESUMPTIVE_TB_RESPIRATORY_SYMPTOMS as readonly string[]).includes(symptom)
  )
  return hasRespiratory ? 'Pulmonary tuberculosis' : 'Extrapulmonary tuberculosis'
}

export function buildPresumptiveTbDiagnosisEntry(
  tbSymptoms: string[],
  symptomLabels: Record<string, string>,
  constitutionalSymptoms: string
): DiagnosisEntry {
  const level3 = resolvePresumptiveTbLevel3(tbSymptoms)
  const symptomList = tbSymptoms.map((key) => symptomLabels[key] ?? key).join(', ')
  const comments = constitutionalSymptoms.trim()
    ? `TB symptoms: ${symptomList || '—'}; Constitutional: ${constitutionalSymptoms.trim()}`
    : `TB symptoms: ${symptomList || '—'}`

  return {
    type: 'National Treatment Guideline',
    level1: 'Infections',
    level2: 'Tuberculosis',
    level3,
    path: `Infections > Tuberculosis > ${level3}`,
    certainty: 'Possible',
    attendance: 'First visit',
    comments,
  }
}

export function hasPresumptiveTbDiagnosis(entries: DiagnosisEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.level2 === 'Tuberculosis' ||
      entry.path.toLowerCase().includes('tuberculosis')
  )
}

export function mergePresumptiveTbDiagnosis(
  provisionalDiagnosis: string,
  entry: DiagnosisEntry
): string {
  const parsed = parseJsonArrayField<DiagnosisEntry>(provisionalDiagnosis)
  if (hasPresumptiveTbDiagnosis(parsed.entries)) {
    return provisionalDiagnosis
  }

  if (parsed.entries.length > 0) {
    return JSON.stringify([...parsed.entries, entry])
  }

  return JSON.stringify([entry])
}

export function formatFinalDiagnosisFromEntry(entry: DiagnosisEntry): string {
  const note = entry.comments ? `; ${entry.comments}` : ''
  return `${entry.path} (${entry.certainty}, ${entry.attendance})${note}`
}
