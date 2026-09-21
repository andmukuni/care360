import { test } from '@japa/runner'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { isPharmacyEncounterCloseableWithoutPrescription } from '#support/encounter/stage_prerequisites'

test.group('Pharmacy encounters without prescription', () => {
  test('closes queued pharmacy encounters that have no medication', ({ assert }) => {
    assert.isTrue(
      isPharmacyEncounterCloseableWithoutPrescription({
        stage: EncounterStage.Pharmacy,
        status: EncounterStatus.Queued,
        isLocked: false,
        hasPrescriptionItems: false,
      })
    )
  })

  test('closes in-progress pharmacy encounters that have no medication', ({ assert }) => {
    assert.isTrue(
      isPharmacyEncounterCloseableWithoutPrescription({
        stage: EncounterStage.Pharmacy,
        status: EncounterStatus.InProgress,
        isLocked: false,
        hasPrescriptionItems: false,
      })
    )
  })

  test('does not close pharmacy encounters that have medication', ({ assert }) => {
    assert.isFalse(
      isPharmacyEncounterCloseableWithoutPrescription({
        stage: EncounterStage.Pharmacy,
        status: EncounterStatus.Queued,
        isLocked: false,
        hasPrescriptionItems: true,
      })
    )
  })

  test('does not close screening encounters', ({ assert }) => {
    assert.isFalse(
      isPharmacyEncounterCloseableWithoutPrescription({
        stage: EncounterStage.Screening,
        status: EncounterStatus.InProgress,
        isLocked: false,
        hasPrescriptionItems: false,
      })
    )
  })
})
