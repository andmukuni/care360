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
 * Queues an in-progress Screening Review encounter to the Treatment Room.
 */
export default class QueueEncounterToTreatmentRoomFromScreeningReviewAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    clinicianId: number,
    notes: string | null = null
  ): Promise<EncounterQueueTransition> {
    const transition = await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.ScreeningReview)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      await this.workflowService.completeStageLog(encounter, clinicianId, notes, trx)

      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.TreatmentRoom,
        clinicianId,
        notes,
        trx
      )

      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.TreatmentRoom,
        EncounterStatus.Queued,
        trx
      )

      await this.auditService.record({
        encounter,
        actionName: 'queued_to_treatment_room_from_screening_review',
        actionStage: EncounterStage.TreatmentRoom,
        actionBy: clinicianId,
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.ScreeningReview,
      EncounterStage.TreatmentRoom,
      clinicianId
    )

    return transition
  }
}
