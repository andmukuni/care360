const ELEVATED_PRIORITIES = new Set(['urgent', 'emergency', 'stat'])

export function normalizePriority(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function shouldShowPriorityBadge(priority: string | null | undefined): boolean {
  const normalized = normalizePriority(priority)
  return normalized !== '' && normalized !== 'normal'
}

export function isElevatedPriority(priority: string | null | undefined): boolean {
  return ELEVATED_PRIORITIES.has(normalizePriority(priority))
}
