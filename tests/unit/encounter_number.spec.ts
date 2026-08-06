import { test } from '@japa/runner'
import {
  encounterNumberPrefix,
  formatEncounterNumber,
  isUniqueEncounterNumberViolation,
} from '#support/encounter/encounter_number'
import { toISODateString } from '#support/encounter/coerce'

test.group('encounter_number', () => {
  test('formatEncounterNumber pads the daily sequence to five digits', ({ assert }) => {
    const prefix = encounterNumberPrefix()
    assert.match(formatEncounterNumber(prefix, 63), /^ENC-\d{8}-00063$/)
    assert.match(formatEncounterNumber(prefix, 12345), /^ENC-\d{8}-12345$/)
  })

  test('isUniqueEncounterNumberViolation detects encounter_number duplicate key errors', ({ assert }) => {
    assert.isTrue(
      isUniqueEncounterNumberViolation({
        code: '23505',
        constraint: 'idx_16637_encounters_encounter_number_unique',
        message: 'duplicate key value violates unique constraint',
      })
    )
    assert.isFalse(isUniqueEncounterNumberViolation({ code: '23505', constraint: 'patients_email_unique' }))
    assert.isFalse(isUniqueEncounterNumberViolation(new Error('other failure')))
  })
})

test.group('toISODateString', () => {
  test('accepts ISO and SQL date strings', ({ assert }) => {
    assert.equal(toISODateString('2026-08-28'), '2026-08-28')
    assert.equal(toISODateString('2026-08-28 00:00:00'), '2026-08-28')
  })

  test('accepts JS date string fragments produced by String(Date)', ({ assert }) => {
    assert.equal(toISODateString('Fri Aug 28 2026 02:00:00 GMT+0200'), '2026-08-28')
  })

  test('accepts short weekday display values accidentally submitted from UI', ({ assert }) => {
    assert.equal(toISODateString('Sun Aug 28'), '2026-08-28')
  })

  test('returns null for empty or invalid input', ({ assert }) => {
    assert.isNull(toISODateString(''))
    assert.isNull(toISODateString('not-a-date'))
  })
})
