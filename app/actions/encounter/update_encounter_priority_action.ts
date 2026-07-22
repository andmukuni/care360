import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus, EncounterStatusHelper } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import QueueCache from '#services/cache/queue_cache'

export const ENCOUNTER_PRIORITY_LEVELS = ['normal', 'urgent', 'emergency'] as const
export type EncounterPriorityLevel = (typeof ENCOUNTER_PRIORITY_LEVELS)[number]

/**
 * Updates clinical priority (normal / urgent / emergency) for an active encounter.
 * Used from stage queues when a patient's acuity changes mid-visit.
 */
export default class UpdateEncounterPriorityAction {
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    priorityLevel: EncounterPriorityLevel,
    actorId: number
  ): Promise<Encounter> {
    if (!EncounterStatusHelper.isActive(encounter.currentStatus as EncounterStatus)) {
      throw new Error('Priority can only be changed on an active encounter.')
    }

    const previous = encounter.priorityLevel ?? 'normal'
    if (previous === priorityLevel) {
      return encounter
    }

    await db.transaction(async (trx) => {
      encounter.useTransaction(trx)
      this.lockService.assertNotLocked(encounter)

      encounter.priorityLevel = priorityLevel
      await encounter.save()

      await this.auditService.record({
        encounter,
        actionName: 'priority_changed',
        actionStage: (encounter.currentStage as EncounterStage) ?? EncounterStage.Registration,
        actionBy: actorId,
        oldValues: { priority_level: previous },
        newValues: { priority_level: priorityLevel },
        client: trx,
      })
    })

    await QueueCache.invalidateStages([encounter.currentStage, EncounterStage.Registration])
    return encounter
  }
}
