import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import type EncounterQueueTransition from '#models/encounter_queue_transition'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterNotifier } from '#services/encounter/encounter_notifier'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'

/**
 * Queues an in-progress Pharmacy encounter to the Treatment Room.
 * Ported from App\Actions\Encounter\QueueEncounterToTreatmentRoomAction.
 */
export default class QueueEncounterToTreatmentRoomAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    pharmacistId: number,
    notes: string | null = null
  ): Promise<EncounterQueueTransition> {
    const transition = await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Pharmacy)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      // 1. Close the open pharmacy queue transition.
      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      // 2. Close the pharmacy stage log.
      await this.workflowService.completeStageLog(encounter, pharmacistId, notes, trx)

      // 3. Create the transition → treatment_room.
      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.TreatmentRoom,
        pharmacistId,
        notes,
        trx
      )

      // 4. Advance stage.
      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.TreatmentRoom,
        EncounterStatus.Queued,
        trx
      )

      // 5. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'queued_to_treatment_room',
        actionStage: EncounterStage.TreatmentRoom,
        actionBy: pharmacistId,
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Pharmacy,
      EncounterStage.TreatmentRoom,
      pharmacistId
    )

    return transition
  }
}
