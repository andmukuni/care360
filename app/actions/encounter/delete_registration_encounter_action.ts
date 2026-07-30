import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import EncounterStageLog from '#models/encounter_stage_log'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { staffQueueBroadcast } from '#services/staff/staff_queue_broadcast_service'

/**
 * Soft-deletes an encounter that is still at Registration (before triage).
 * Used when a visit was started by mistake and has not left the desk.
 */
export default class DeleteRegistrationEncounterAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly lockService = new EncounterLockService()
  private readonly auditService = new EncounterAuditService()

  async handle(encounter: Encounter, deletedBy: number): Promise<void> {
    await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Registration)

      if (encounter.closedAt !== null) {
        throw new Error(`Encounter [${encounter.encounterNumber}] is already closed.`)
      }

      const openLog = await EncounterStageLog.query({ client: trx })
        .where('encounter_id', encounter.id)
        .where('stage_name', EncounterStage.Registration)
        .whereNull('completed_at')
        .orderBy('id', 'desc')
        .first()

      if (openLog) {
        openLog.useTransaction(trx)
        openLog.status = QueueTransitionStatus.Completed
        openLog.completedBy = deletedBy
        openLog.completedAt = DateTime.now()
        openLog.notes = openLog.notes
          ? `${openLog.notes}\nDeleted at registration.`
          : 'Deleted at registration.'
        await openLog.save()
      }

      encounter.useTransaction(trx)
      encounter.currentStatus = EncounterStatus.Cancelled
      encounter.closedAt = DateTime.now()
      encounter.closedBy = deletedBy
      encounter.closureNotes = 'Deleted at registration before queueing to triage.'
      encounter.isLocked = true
      await encounter.save()
      await encounter.softDelete()

      await this.auditService.record({
        encounter,
        actionName: 'encounter_deleted_at_registration',
        actionStage: EncounterStage.Registration,
        actionBy: deletedBy,
        newValues: {
          status: EncounterStatus.Cancelled,
          deleted_at: encounter.deletedAt?.toISO() ?? null,
        },
        notes: 'Deleted at registration before queueing to triage.',
        client: trx,
      })

      staffQueueBroadcast.notifyStages([EncounterStage.Registration], trx)
    })
  }
}
