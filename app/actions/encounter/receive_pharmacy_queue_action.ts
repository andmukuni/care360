import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'

/**
 * Receives a patient into Pharmacy (from screening_review or screening).
 * Ported from App\Actions\Encounter\ReceivePharmacyQueueAction.
 */
export default class ReceivePharmacyQueueAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(encounter: Encounter, pharmacistId: number): Promise<void> {
    await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Pharmacy)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.Queued)

      const transition = await this.queueService.getOpenTransition(encounter, trx)
      if (transition) {
        await this.queueService.receive(transition, pharmacistId, trx)
      }

      await this.workflowService.openStageLog(encounter, pharmacistId, null, {}, trx)

      await this.workflowService.markInProgress(encounter, trx)

      await this.auditService.record({
        encounter,
        actionName: 'pharmacy_received',
        actionStage: EncounterStage.Pharmacy,
        actionBy: pharmacistId,
        client: trx,
      })
    })
  }
}
