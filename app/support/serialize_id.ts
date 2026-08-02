/**
 * Coerce a database / JSON id into a positive integer for Inertia and API payloads.
 */
export function serializeId(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`Invalid id value: ${String(value)}`)
  }
  return n
}

/**
 * Like serializeId but returns null for empty / invalid values.
 */
export function serializeIdOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return null
  }
  return n
}
