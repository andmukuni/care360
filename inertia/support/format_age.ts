/**
 * Human-readable patient age, with day/week/month granularity for infants
 * under one year (where a whole-year calculation would otherwise read "0").
 */

type AgeParts = { years: number; months: number; days: number }

function calculateAgeParts(dateOfBirth: string | null | undefined, now: Date = new Date()): AgeParts | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime()) || dob.getTime() > now.getTime()) return null

  let years = now.getFullYear() - dob.getFullYear()
  let months = now.getMonth() - dob.getMonth()
  let days = now.getDate() - dob.getDate()

  if (days < 0) {
    months -= 1
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  return { years, months, days }
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

/** Total whole months of age — used to bucket patients into clinical age bands (e.g. vital sign ranges). */
export function ageInMonths(dateOfBirth: string | null | undefined, now: Date = new Date()): number | null {
  const parts = calculateAgeParts(dateOfBirth, now)
  if (!parts) return null
  return parts.years * 12 + parts.months
}

/** Compact form for chips/badges, e.g. "3 yrs", "5 mos", "2 wks", "4 days", "Newborn". */
export function formatAge(dateOfBirth: string | null | undefined, now: Date = new Date()): string | null {
  const parts = calculateAgeParts(dateOfBirth, now)
  if (!parts) return null
  const { years, months, days } = parts

  if (years >= 1) return `${years} yr${years === 1 ? '' : 's'}`
  if (months >= 1) return `${months} mo${months === 1 ? '' : 's'}`
  if (days >= 7) {
    const weeks = Math.floor(days / 7)
    return `${weeks} wk${weeks === 1 ? '' : 's'}`
  }
  return days === 0 ? 'Newborn' : `${days} day${days === 1 ? '' : 's'}`
}

/**
 * Compact age label for children under one year only — null for anyone one
 * year or older (or an unknown DOB), so callers can flag infants without
 * cluttering the display for older patients.
 */
export function formatInfantAge(dateOfBirth: string | null | undefined, now: Date = new Date()): string | null {
  const parts = calculateAgeParts(dateOfBirth, now)
  if (!parts || parts.years >= 1) return null
  return formatAge(dateOfBirth, now)
}

/** Descriptive form for labels/tooltips, e.g. "5 months, 12 days old". */
export function formatAgeLong(dateOfBirth: string | null | undefined, now: Date = new Date()): string | null {
  const parts = calculateAgeParts(dateOfBirth, now)
  if (!parts) return null
  const { years, months, days } = parts

  if (years >= 1) {
    return months > 0 ? `${plural(years, 'year')}, ${plural(months, 'month')} old` : `${plural(years, 'year')} old`
  }
  if (months >= 1) {
    return days > 0 ? `${plural(months, 'month')}, ${plural(days, 'day')} old` : `${plural(months, 'month')} old`
  }
  if (days >= 7) {
    const weeks = Math.floor(days / 7)
    const remainder = days % 7
    return remainder > 0
      ? `${plural(weeks, 'week')}, ${plural(remainder, 'day')} old`
      : `${plural(weeks, 'week')} old`
  }
  return days === 0 ? 'Newborn (born today)' : `${plural(days, 'day')} old`
}
