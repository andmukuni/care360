import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import EncounterStageLog from '#models/encounter_stage_log'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { assertCanReopenEncounter } from '#support/encounter/reopen_encounter_policy'

/**
 * Reopens a locked, completed encounter for further editing, restoring it to
 * the last completed clinical stage (in_progress).
 * Ported from App\Actions\Encounter\ReopenEncounterAction.
 */
export default class ReopenEncounterAction {
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    actorId: number,
    notes: string | null = null
  ): Promise<Encounter> {
    return db.transaction(async (trx) => {
      if (!encounter.isLocked) {
        throw new Error('Only locked encounters can be reopened.')
      }

      if (encounter.currentStage !== EncounterStage.Completed) {
        throw new Error('Only completed encounters can be reopened.')
      }

      assertCanReopenEncounter(encounter)

      const lastLog = await EncounterStageLog.query({ client: trx })
        .where('encounter_id', encounter.id)
        .whereNotNull('completed_at')
        .whereNot('stage_name', EncounterStage.Completed)
        .orderBy('stage_sequence', 'desc')
        .first()

      if (!lastLog) {
        throw new Error('No completed stage log found to restore this encounter.')
      }

      const restoreStage = lastLog.stageName as EncounterStage

      const oldValues = {
        current_stage: encounter.currentStage,
        current_status: encounter.currentStatus,
        is_locked: true,
        closed_at: encounter.closedAt?.toISO() ?? null,
      }

      await this.lockService.unlock(encounter, trx)

      encounter.useTransaction(trx)
      encounter.currentStage = restoreStage
      encounter.currentStatus = EncounterStatus.InProgress
      encounter.closedAt = null
      encounter.closedBy = null
      encounter.closureNotes = null
      await encounter.save()

      lastLog.useTransaction(trx)
      lastLog.status = QueueTransitionStatus.Received
      lastLog.completedBy = null
      lastLog.completedAt = null
      lastLog.notes = notes ?? lastLog.notes
      await lastLog.save()

      await this.auditService.record({
        encounter,
        actionName: 'encounter_reopened',
        actionStage: restoreStage,
        actionBy: actorId,
        oldValues,
        newValues: {
          current_stage: restoreStage,
          current_status: EncounterStatus.InProgress,
          is_locked: false,
        },
        notes,
        client: trx,
      })

      return encounter
    })
  }
}
