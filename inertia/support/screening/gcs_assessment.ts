export type GcsAssessment = {
  eye: string
  verbal: string
  motor: string
  score: number
  result: string
}

const GCS_PATTERN =
  /^GCS - Eye:\s*(.*?);\s*Verbal:\s*(.*?);\s*Motor:\s*(.*?);\s*Score:\s*(\d+)\/15;\s*Result:\s*(.*)$/i

export function isGcsAssessmentNotes(value: string | null | undefined): boolean {
  return !!value && value.startsWith('GCS - Eye:')
}

export function parseGcsAssessmentNotes(value: string | null | undefined): GcsAssessment | null {
  if (!isGcsAssessmentNotes(value)) return null

  const match = value!.match(GCS_PATTERN)
  if (!match) return null

  return {
    eye: match[1].trim(),
    verbal: match[2].trim(),
    motor: match[3].trim(),
    score: Number.parseInt(match[4], 10),
    result: match[5].trim(),
  }
}

export function extractGcsPoints(label: string): string | null {
  const match = label.match(/\((\d+)\s*points?\)/i)
  return match ? match[1] : null
}

export function gcsSeverityLabel(score: number): string {
  if (score >= 13) return 'Mild'
  if (score >= 9) return 'Moderate'
  return 'Severe'
}

export function gcsSeverityClass(score: number): string {
  if (score >= 13) return 'gcs-score--mild'
  if (score >= 9) return 'gcs-score--moderate'
  return 'gcs-score--severe'
}
