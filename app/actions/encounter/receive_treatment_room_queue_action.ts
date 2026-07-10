import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'

/**
 * Receives a patient into the Treatment Room from the queue.
 * Ported from App\Actions\Encounter\ReceiveTreatmentRoomQueueAction.
 */
export default class ReceiveTreatmentRoomQueueAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(encounter: Encounter, nurseId: number): Promise<void> {
    await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.TreatmentRoom)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.Queued)

      const transition = await this.queueService.getOpenTransition(encounter, trx)
      if (transition) {
        await this.queueService.receive(transition, nurseId, trx)
      }

      await this.workflowService.openStageLog(encounter, nurseId, null, {}, trx)

      // Advance status to in_progress.
      encounter.useTransaction(trx)
      encounter.currentStatus = EncounterStatus.InProgress
      await encounter.save()

      await this.auditService.record({
        encounter,
        actionName: 'received_at_treatment_room',
        actionStage: EncounterStage.TreatmentRoom,
        actionBy: nurseId,
        client: trx,
      })
    })
  }
}
