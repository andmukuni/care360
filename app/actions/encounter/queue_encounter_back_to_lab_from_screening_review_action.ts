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
import { getLabRequest } from '#services/encounter/encounter_records'

/**
 * Returns an in-progress Screening Review encounter to Lab for additional tests.
 */
export default class QueueEncounterBackToLabFromScreeningReviewAction {
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

      const labRequest = await getLabRequest(encounter.id, trx)
      if (!labRequest) {
        throw new Error('No lab request found for this encounter.')
      }

      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      await this.workflowService.completeStageLog(encounter, clinicianId, notes, trx)

      labRequest.useTransaction(trx)
      labRequest.status = 'in_progress'
      labRequest.completedAt = null
      await labRequest.save()

      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Lab,
        clinicianId,
        notes,
        trx
      )

      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Lab,
        EncounterStatus.Queued,
        trx
      )

      await this.auditService.record({
        encounter,
        actionName: 'queued_back_to_lab_from_screening_review',
        actionStage: EncounterStage.ScreeningReview,
        actionBy: clinicianId,
        newValues: { to_stage: EncounterStage.Lab },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.ScreeningReview,
      EncounterStage.Lab,
      clinicianId
    )

    return transition
  }
}
