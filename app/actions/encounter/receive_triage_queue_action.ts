import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'

/**
 * Triage nurse receives the queued encounter.
 * Ported from App\Actions\Encounter\ReceiveTriageQueueAction.
 */
export default class ReceiveTriageQueueAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(encounter: Encounter, nurseId: number): Promise<Encounter> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Triage)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.Queued)

      const transition = await this.queueService.getOpenTransition(encounter, trx)
      if (transition) {
        await this.queueService.receive(transition, nurseId, trx)
      }

      await this.workflowService.openStageLog(encounter, nurseId, null, {}, trx)

      await this.workflowService.markInProgress(encounter, trx)

      await this.auditService.record({
        encounter,
        actionName: 'triage_received',
        actionStage: EncounterStage.Triage,
        actionBy: nurseId,
        client: trx,
      })

      return encounter
    })
  }
}
