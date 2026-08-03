import { test } from '@japa/runner'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStageMap } from '#support/encounter/encounter_stage_map'

test.group('encounter_stage_map', () => {
  test('allows lab to return to screening when no lab work exists', ({ assert }) => {
    assert.isTrue(
      EncounterStageMap.canTransitionTo(EncounterStage.Lab, EncounterStage.Screening)
    )
  })

  test('still allows lab to complete to screening review', ({ assert }) => {
    assert.isTrue(
      EncounterStageMap.canTransitionTo(EncounterStage.Lab, EncounterStage.ScreeningReview)
    )
  })

  test('allows pharmacy to return to screening', ({ assert }) => {
    assert.isTrue(
      EncounterStageMap.canTransitionTo(EncounterStage.Pharmacy, EncounterStage.Screening)
    )
  })
})
