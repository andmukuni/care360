import cache from '@adonisjs/cache/services/main'
import env from '#start/env'
import type { EncounterStage } from '#enums/encounter_stage'
import { queueStageTag, QUEUE_TAGS } from '#services/cache/queue_cache_keys'
import { safeCacheGetOrSet, safeCacheMutation } from '#services/cache/safe_cache'

const QUEUE_TTL = env.get('CACHE_QUEUE_TTL', '60s')

export default class QueueCache {
  static ttl(): string {
    return QUEUE_TTL
  }

  static async getOrSet<T>(
    key: string,
    stage: EncounterStage | string,
    factory: () => Promise<T>
  ): Promise<T> {
    return safeCacheGetOrSet(
      `queue.getOrSet:${key}`,
      () =>
        cache.getOrSet({
          key,
          ttl: QUEUE_TTL,
          tags: [QUEUE_TAGS.all, queueStageTag(stage)],
          factory,
        }),
      factory
    )
  }

  static async invalidateStages(stages: (EncounterStage | string)[]): Promise<void> {
    const tags = [...new Set(stages.map((stage) => queueStageTag(stage)))]
    if (tags.length === 0) return
    await safeCacheMutation('queue.invalidateStages', () => cache.deleteByTag({ tags }))
  }

  static async invalidateAll(): Promise<void> {
    await safeCacheMutation('queue.invalidateAll', () =>
      cache.deleteByTag({ tags: [QUEUE_TAGS.all] })
    )
  }
}
