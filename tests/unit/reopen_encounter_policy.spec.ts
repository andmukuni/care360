import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import {
  REOPEN_MAX_ENCOUNTER_HOURS,
  encounterDurationHours,
  reopenEligibility,
} from '#support/encounter/reopen_encounter_policy'

function makeClosedEncounter(startedAt: DateTime, closedAt: DateTime): Encounter {
  const encounter = new Encounter()
  encounter.id = 1
  encounter.isLocked = true
  encounter.currentStage = EncounterStage.Completed
  encounter.startedAt = startedAt
  encounter.closedAt = closedAt
  return encounter
}

test.group('reopen encounter policy', () => {
  test('allows reopen for encounter closed today within 12 hours', ({ assert }) => {
    const now = DateTime.now()
    const encounter = makeClosedEncounter(now.minus({ hours: 6 }), now.minus({ hours: 1 }))

    const result = reopenEligibility(encounter)
    assert.isTrue(result.allowed)
    assert.isNull(result.reason)
  })

  test('blocks reopen when encounter duration exceeds 12 hours', ({ assert }) => {
    const now = DateTime.now()
    const encounter = makeClosedEncounter(now.minus({ hours: 14 }), now.minus({ hours: 1 }))

    const result = reopenEligibility(encounter)
    assert.isFalse(result.allowed)
    assert.include(result.reason ?? '', `${REOPEN_MAX_ENCOUNTER_HOURS} hours`)
  })

  test('blocks reopen when encounter was closed before today', ({ assert }) => {
    const yesterday = DateTime.now().minus({ days: 1 })
    const encounter = makeClosedEncounter(yesterday.minus({ hours: 4 }), yesterday)

    const result = reopenEligibility(encounter)
    assert.isFalse(result.allowed)
    assert.include(result.reason ?? '', 'today')
  })

  test('encounterDurationHours measures start to close', ({ assert }) => {
    const start = DateTime.fromISO('2026-07-08T08:00:00')
    const close = DateTime.fromISO('2026-07-08T20:30:00')
    const encounter = makeClosedEncounter(start, close)

    assert.equal(encounterDurationHours(encounter), 12.5)
  })
})
