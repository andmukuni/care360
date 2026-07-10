import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { assertCanReopenEncounter } from '#support/encounter/reopen_encounter_policy'

/**
 * Reopens a locked, completed encounter and queues the patient to a chosen
 * stage — any department in the pipeline, not just the last one worked.
 * Ported from App\Actions\Encounter\ReopenEncounterToStageAction.
 */
export default class ReopenEncounterToStageAction {
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly queueService = new EncounterQueueService()
  private readonly workflowService = new EncounterWorkflowService()

  async handle(
    encounter: Encounter,
    targetStage: EncounterStage,
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

      if (EncounterStageHelper.isTerminal(targetStage)) {
        throw new Error('Cannot queue a reopened encounter to the Completed stage.')
      }

      const oldValues = {
        current_stage: encounter.currentStage,
        current_status: encounter.currentStatus,
        is_locked: true,
        closed_at: encounter.closedAt?.toISO() ?? null,
      }

      const targetStatus =
        targetStage === EncounterStage.Registration
          ? EncounterStatus.Started
          : EncounterStatus.Queued

      if (targetStage !== EncounterStage.Registration) {
        // from_stage reads the current (still Completed) stage.
        await this.queueService.queueTo(encounter, targetStage, actorId, notes, trx)
      }

      await this.lockService.unlock(encounter, trx)

      encounter.useTransaction(trx)
      encounter.currentStage = targetStage
      encounter.currentStatus = targetStatus
      encounter.closedAt = null
      encounter.closedBy = null
      encounter.closureNotes = null
      await encounter.save()

      if (targetStage === EncounterStage.Registration) {
        await this.workflowService.openStageLog(encounter, actorId, notes, {}, trx)
      }

      await this.auditService.record({
        encounter,
        actionName: 'encounter_reopened_to_stage',
        actionStage: targetStage,
        actionBy: actorId,
        oldValues,
        newValues: {
          current_stage: targetStage,
          current_status: targetStatus,
          is_locked: false,
        },
        notes,
        client: trx,
      })

      return encounter
    })
  }
}
