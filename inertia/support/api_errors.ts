/**
 * Normalize Adonis/Vine/Bouncer JSON error payloads into a user-facing string.
 */
export function formatApiErrors(payload: unknown, fallback = 'Request failed.'): string {
  if (!payload || typeof payload !== 'object') return fallback

  const record = payload as Record<string, unknown>
  const errors = record.errors

  if (Array.isArray(errors)) {
    const messages = errors
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object' && 'message' in entry) {
          const message = (entry as { message?: unknown }).message
          return typeof message === 'string' ? message : null
        }
        return null
      })
      .filter((message): message is string => Boolean(message))

    if (messages.length) return messages.join(', ')
  }

  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors as Record<string, unknown>)
      .flat()
      .map((value) => (typeof value === 'string' ? value : null))
      .filter((value): value is string => Boolean(value))

    if (messages.length) return messages.join(', ')
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message
  }

  return fallback
}
