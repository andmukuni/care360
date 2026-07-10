export function diagnosisLabel(raw: string | null | undefined, maxLength?: number): string | null {
  if (!raw?.trim()) return null

  try {
    const decoded = JSON.parse(raw)
    if (Array.isArray(decoded)) {
      const labels = decoded
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return ''
          const record = entry as Record<string, unknown>
          return String(
            record.level3 ?? record.level2 ?? record.level1 ?? record.icd11 ?? record.path ?? ''
          ).trim()
        })
        .filter(Boolean)
        .join(', ')

      if (!labels) return null
      return maxLength && labels.length > maxLength ? `${labels.slice(0, maxLength)}…` : labels
    }
  } catch {
    // Plain text diagnosis
  }

  const text = raw.trim()
  if (maxLength && text.length > maxLength) return `${text.slice(0, maxLength)}…`
  return text
}
