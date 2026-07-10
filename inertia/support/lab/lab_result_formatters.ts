export function formatLabResultValue(result: {
  result_value: string | null
  result_text: string | null
} | null): string {
  if (!result) return 'Pending'

  const value = result.result_value?.trim() ?? ''
  const text = result.result_text?.trim() ?? ''

  if (!value && !text) return '—'
  if (value && text && value !== text) return text
  return value || text
}

export function formatInterpretationLabel(interpretation: string | null | undefined): string {
  const value = String(interpretation ?? '').trim()
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}
