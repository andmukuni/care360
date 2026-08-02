import { test } from '@japa/runner'
import { EncounterStage } from '#enums/encounter_stage'
import { baseQueueRow } from '#support/queue/stage_queue_helpers'
import { serializeId, serializeIdOrNull } from '#support/serialize_id'

test.group('serializeId', () => {
  test('parses numeric strings from PostgreSQL bigint', ({ assert }) => {
    assert.equal(serializeId('238'), 238)
    assert.equal(serializeId(238), 238)
  })

  test('serializeIdOrNull returns null for empty values', ({ assert }) => {
    assert.isNull(serializeIdOrNull(null))
    assert.isNull(serializeIdOrNull(undefined))
    assert.isNull(serializeIdOrNull(''))
    assert.isNull(serializeIdOrNull('abc'))
  })

  test('serializeIdOrNull parses valid ids', ({ assert }) => {
    assert.equal(serializeIdOrNull('235'), 235)
    assert.equal(serializeIdOrNull(235), 235)
  })

  test('serializeId rejects invalid values', ({ assert }) => {
    assert.throws(() => serializeId(''), /Invalid id/)
    assert.throws(() => serializeId('0'), /Invalid id/)
    assert.throws(() => serializeId('-1'), /Invalid id/)
  })
})

test.group('baseQueueRow id serialization', () => {
  test('coerces string encounter id to number in queue row', ({ assert }) => {
    const row = baseQueueRow(
      {
        id: '238',
        encounterNumber: 'ENC-20260802-00003',
        patient: null,
        visitType: 'opd',
        priorityLevel: 'emergency',
        updatedAt: null,
        encounterQueueTransitions: [],
      } as any,
      {
        stage: EncounterStage.Screening,
        currentUserId: null,
      }
    )

    assert.equal(row.id, 238)
    assert.typeOf(row.id, 'number')
  })
})
