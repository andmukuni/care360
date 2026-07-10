import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import transmit from '@adonisjs/transmit/services/main'
import type { EncounterStage } from '#enums/encounter_stage'
import QueueCache from '#services/cache/queue_cache'

export type StaffQueueBroadcastPayload = {
  stages: EncounterStage[]
}

/**
 * Pushes queue change notifications to staff SSE subscribers so queue pages
 * can reload Inertia props without waiting for a poll interval.
 */
export class StaffQueueBroadcastService {
  notifyStages(stages: EncounterStage[], client?: TransactionClientContract): void {
    const uniqueStages = [...new Set(stages)]
    if (uniqueStages.length === 0) {
      return
    }

    const broadcast = () => {
      void QueueCache.invalidateStages(uniqueStages)
      transmit.broadcast('staff/queues', { stages: uniqueStages } satisfies StaffQueueBroadcastPayload)
    }

    if (client) {
      client.after('commit', broadcast)
      return
    }

    broadcast()
  }
}

export const staffQueueBroadcast = new StaffQueueBroadcastService()
