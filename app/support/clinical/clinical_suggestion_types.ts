export type ClinicalSuggestionSource = {
  test_name?: string | null
  result?: string | null
  trigger?: string | null
}

export type FieldSuggestion = {
  id: number
  text: string
  source: ClinicalSuggestionSource
}

export type PrescriptionSuggestion = {
  id: number
  items: Array<Record<string, unknown>>
  source: ClinicalSuggestionSource
}

export type ClinicalSuggestionsPayload = {
  fields: Record<string, FieldSuggestion[]>
  prescriptions: PrescriptionSuggestion[]
}

export const CLINICAL_FIELD_KEYS = [
  'final_diagnosis',
  'clinical_findings',
  'physical_examination',
  'assessment_notes',
  'plan',
  'review_notes',
  'treatment_plan',
  'provisional_diagnosis',
  'chief_complaint_brief',
] as const

export type ClinicalFieldKey = (typeof CLINICAL_FIELD_KEYS)[number]

export const STAGE_SCOPES = [
  'screening_review',
  'screening',
  'triage',
  'pharmacy',
] as const

export type StageScope = (typeof STAGE_SCOPES)[number]
