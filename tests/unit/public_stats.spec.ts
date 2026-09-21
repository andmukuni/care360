import { test } from '@japa/runner'
import { EncounterStage } from '#enums/encounter_stage'
import {
  applyLiveStageCounts,
  classifyPatientGender,
  emptyLiveQueueCounts,
} from '#support/public/public_stats'

test.group('Public stats helpers', () => {
  test('classifies male and female values used at registration', ({ assert }) => {
    assert.equal(classifyPatientGender('male'), 'male')
    assert.equal(classifyPatientGender('Male'), 'male')
    assert.equal(classifyPatientGender('M'), 'male')
    assert.equal(classifyPatientGender('female'), 'female')
    assert.equal(classifyPatientGender('Female'), 'female')
    assert.equal(classifyPatientGender('F'), 'female')
  })

  test('treats blank or unknown gender as unspecified', ({ assert }) => {
    assert.equal(classifyPatientGender(null), 'unspecified')
    assert.equal(classifyPatientGender(''), 'unspecified')
    assert.equal(classifyPatientGender('other'), 'unspecified')
  })

  test('live queue counts start at zero for every active stage', ({ assert }) => {
    const live = emptyLiveQueueCounts()
    assert.equal(live[EncounterStage.Triage], 0)
    assert.equal(live[EncounterStage.Screening], 0)
    assert.equal(live[EncounterStage.Pharmacy], 0)
    assert.notProperty(live, EncounterStage.Completed)
  })

  test('applies live stage totals without exposing completed encounters', ({ assert }) => {
    const live = applyLiveStageCounts([
      { current_stage: EncounterStage.Screening, total: 4 },
      { current_stage: EncounterStage.Pharmacy, total: '2' },
      { current_stage: EncounterStage.Completed, total: 99 },
    ])

    assert.equal(live[EncounterStage.Screening], 4)
    assert.equal(live[EncounterStage.Pharmacy], 2)
    assert.equal(live[EncounterStage.Triage], 0)
    assert.notProperty(live, EncounterStage.Completed)
  })
})
