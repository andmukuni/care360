import { test } from '@japa/runner'
import cache from '@adonisjs/cache/services/main'
import QueueCache from '#services/cache/queue_cache'
import {
  apiStageQueueKey,
  queueStageTag,
  registrationDeskPageKey,
  stageQueuePageKey,
} from '#services/cache/queue_cache_keys'

test.group('Queue cache keys', () => {
  test('stageQueuePageKey encodes pagination and scope', ({ assert }) => {
    assert.equal(
      stageQueuePageKey({
        stage: 'triage',
        scope: 'adult',
        queuedPage: 2,
        progressPage: 3,
        orderBy: 'clinical',
      }),
      'queue:triage:adult:clinical:q2:p3'
    )
  })

  test('registrationDeskPageKey encodes page number', ({ assert }) => {
    assert.equal(registrationDeskPageKey(4), 'queue:registration:desk:p4')
  })

  test('apiStageQueueKey scopes API payloads by stage', ({ assert }) => {
    assert.equal(apiStageQueueKey('pharmacy'), 'queue:api:pharmacy')
  })
})

test.group('Queue cache service', () => {
  test('getOrSet caches factory result per stage key', async ({ assert }) => {
    let factoryCalls = 0
    const key = stageQueuePageKey({
      stage: 'lab',
      queuedPage: 1,
      progressPage: 1,
    })

    const first = await QueueCache.getOrSet(key, 'lab', async () => {
      factoryCalls++
      return { queued: [{ id: 1 }], inProgress: [] }
    })

    const second = await QueueCache.getOrSet(key, 'lab', async () => {
      factoryCalls++
      return { queued: [{ id: 99 }], inProgress: [] }
    })

    assert.deepEqual(first, second)
    assert.equal(factoryCalls, 1)
  })

  test('invalidateStages clears only matching stage tags', async ({ assert }) => {
    const triageKey = stageQueuePageKey({ stage: 'triage', queuedPage: 1, progressPage: 1 })
    const labKey = stageQueuePageKey({ stage: 'lab', queuedPage: 1, progressPage: 1 })

    await QueueCache.getOrSet(triageKey, 'triage', async () => ({ rows: ['triage'] }))
    await QueueCache.getOrSet(labKey, 'lab', async () => ({ rows: ['lab'] }))

    await QueueCache.invalidateStages(['triage'])

    assert.isFalse(await cache.has({ key: triageKey }))
    assert.isTrue(await cache.has({ key: labKey }))

    await cache.deleteByTag({ tags: [queueStageTag('lab')] })
  })
})
