import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import EncounterAudit from '#models/encounter_audit'
import { EncounterStage } from '#enums/encounter_stage'
import { labActivityHeadline, serializeLabActivity } from '#support/lab/lab_activity_payload'

test.group('lab_activity_payload', () => {
  test('labActivityHeadline maps known lab audit actions', ({ assert }) => {
    assert.equal(labActivityHeadline('lab_samples_collected'), 'Sample(s) collected')
    assert.equal(labActivityHeadline('lab_results_saved'), 'Results saved')
  })

  test('serializeLabActivity includes actor and detail from new values', ({ assert }) => {
    const audit = new EncounterAudit()
    audit.id = 1
    audit.actionName = 'lab_results_saved'
    audit.actionStage = EncounterStage.Lab
    audit.actionAt = DateTime.fromISO('2026-08-03T10:00:00')
    audit.notes = null
    audit.newValues = JSON.stringify({ tests: ['FBC', 'RBS'] }) as unknown as string
    audit.actionByUser = { name: 'Lab Tech One' } as EncounterAudit['actionByUser']

    const [row] = serializeLabActivity([audit])
    assert.equal(row.headline, 'Results saved')
    assert.equal(row.action_by, 'Lab Tech One')
    assert.equal(row.detail, 'FBC, RBS')
  })
})
