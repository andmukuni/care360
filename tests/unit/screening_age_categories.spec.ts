import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  ADULT_MIN_AGE_YEARS,
  isAdultAge,
  isPediatricAge,
  patientAgeYears,
  PEDIATRIC_MAX_AGE_YEARS,
  pediatricBirthDateCutoffIso,
} from '#support/screening/screening_age_categories'

test.group('screening_age_categories', () => {
  test('defines pediatric up to 5 and adult from 6', ({ assert }) => {
    assert.equal(PEDIATRIC_MAX_AGE_YEARS, 5)
    assert.equal(ADULT_MIN_AGE_YEARS, 6)
  })

  test('isPediatricAge includes 5 and excludes 6', ({ assert }) => {
    assert.isTrue(isPediatricAge(5))
    assert.isFalse(isPediatricAge(6))
    assert.isTrue(isPediatricAge(0))
  })

  test('isAdultAge includes 6 and unknown age', ({ assert }) => {
    assert.isTrue(isAdultAge(6))
    assert.isFalse(isAdultAge(5))
    assert.isTrue(isAdultAge(null))
  })

  test('pediatricBirthDateCutoffIso splits 5 vs 6 year olds', ({ assert }) => {
    const cutoff = pediatricBirthDateCutoffIso()
    const exactlyFive = DateTime.now().minus({ years: 5 }).toISODate()!
    const exactlySix = DateTime.now().minus({ years: 6 }).toISODate()!

    assert.isTrue(exactlyFive > cutoff)
    assert.isFalse(exactlySix > cutoff)
    assert.equal(patientAgeYears(DateTime.fromISO(exactlyFive)), 5)
    assert.equal(patientAgeYears(DateTime.fromISO(exactlySix)), 6)
  })
})
