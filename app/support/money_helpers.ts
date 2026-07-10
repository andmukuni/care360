import { randomBytes } from 'node:crypto'

/**
 * Shared numeric / formatting helpers used across the billing, membership and
 * payment services. Postgres returns `numeric`/`decimal` columns as strings via
 * node-postgres, so services coerce money values with {@link num} before doing
 * arithmetic — mirroring Laravel's `(float)` casts.
 */

/** Coerce an unknown value (string | number | null) to a finite number. */
export function num(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Round to 2 decimal places (money). Mirrors PHP round($x, 2). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Alphanumeric random string. Mirrors Laravel's Str::random(). */
export function randomAlnum(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALNUM[bytes[i] % ALNUM.length]
  }
  return out
}

/**
 * Format a number like PHP's number_format(). Defaults to a comma thousands
 * separator and a dot decimal point.
 */
export function numberFormat(
  value: number,
  decimals: number = 2,
  decPoint: string = '.',
  thousandsSep: string = ','
): string {
  const negative = value < 0
  const fixed = Math.abs(value).toFixed(decimals)
  const parts = fixed.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep)
  const result = parts[1] !== undefined ? intPart + decPoint + parts[1] : intPart
  return (negative ? '-' : '') + result
}

/**
 * Format a percent for display, trimming trailing zeros.
 * e.g. 10.00 -> "10", 12.50 -> "12.5". Mirrors the Laravel rtrim() dance.
 */
export function trimPercent(percent: number): string {
  let s = percent.toFixed(2)
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  return s
}
