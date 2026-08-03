import { DateTime } from 'luxon'

/** Inclusive upper age for pediatric screening queue and paediatric tab. */
export const PEDIATRIC_MAX_AGE_YEARS = 5

/** Inclusive lower age for adult screening queue. */
export const ADULT_MIN_AGE_YEARS = PEDIATRIC_MAX_AGE_YEARS + 1

export function patientAgeYears(dob: DateTime | null | undefined): number | null {
  if (!dob) return null
  return Math.floor(DateTime.now().diff(dob, 'years').years)
}

export function isPediatricAge(ageYears: number | null | undefined): boolean {
  return ageYears != null && ageYears <= PEDIATRIC_MAX_AGE_YEARS
}

export function isAdultAge(ageYears: number | null | undefined): boolean {
  return ageYears == null || ageYears >= ADULT_MIN_AGE_YEARS
}

/**
 * Patients born strictly after this ISO date are pediatric (age ≤ 5).
 * Patients born on or before this date are adult (age ≥ 6).
 */
export function pediatricBirthDateCutoffIso(): string {
  return DateTime.now().minus({ years: ADULT_MIN_AGE_YEARS }).toISODate()!
}
