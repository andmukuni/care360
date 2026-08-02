/**
 * Coerce an encounter/entity id from Inertia props (number or string) to number.
 */
export function coerceNumericId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return null
  }
  return n
}

export function sameNumericId(a: unknown, b: unknown): boolean {
  const left = coerceNumericId(a)
  const right = coerceNumericId(b)
  return left !== null && right !== null && left === right
}
