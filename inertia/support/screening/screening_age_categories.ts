/** Keep in sync with app/support/screening/screening_age_categories.ts */
export const PEDIATRIC_MAX_AGE_YEARS = 5
export const ADULT_MIN_AGE_YEARS = 6

export function patientAgeYears(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--
  return years
}

export function isPediatricAge(ageYears: number | null | undefined): boolean {
  return ageYears != null && ageYears <= PEDIATRIC_MAX_AGE_YEARS
}
