import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import type EncounterQueueTransition from '#models/encounter_queue_transition'
import LabResult from '#models/lab_result'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterNotifier } from '#services/encounter/encounter_notifier'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getInitialScreeningRecord, getLabRequest } from '#services/encounter/encounter_records'

/**
 * Completes lab work and queues the encounter back to Screening Review.
 * Ported from App\Actions\Encounter\QueueEncounterBackToScreeningAction.
 */
export default class QueueEncounterBackToScreeningAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    labTechId: number,
    notes: string | null = null
  ): Promise<EncounterQueueTransition> {
    const transition = await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Lab)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const labRequest = await getLabRequest(encounter.id, trx)
      if (!labRequest) {
        throw new Error('No lab request found for this encounter.')
      }

      const hasResults =
        (await LabResult.query({ client: trx })
          .where('lab_request_id', labRequest.id)
          .first()) !== null
      if (!hasResults) {
        throw new Error('At least one result must be recorded before completing the lab stage.')
      }

      // 1. Complete the lab request.
      labRequest.useTransaction(trx)
      labRequest.status = 'completed'
      labRequest.completedAt = DateTime.now()
      await labRequest.save()

      // 2. Stamp returned_from_lab_at on the screening record.
      const screeningRecord = await getInitialScreeningRecord(encounter.id, trx)
      if (screeningRecord) {
        screeningRecord.useTransaction(trx)
        screeningRecord.returnedFromLabAt = DateTime.now()
        await screeningRecord.save()
      }

      // 3. Complete the open incoming (screening → lab) transition.
      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      // 4. Close the lab stage log.
      await this.workflowService.completeStageLog(encounter, labTechId, notes, trx)

      // 5. Create lab → screening_review transition.
      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.ScreeningReview,
        labTechId,
        notes,
        trx
      )

      // 6. Advance encounter to screening_review.
      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.ScreeningReview,
        EncounterStatus.Queued,
        trx
      )

      // 7. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'queued_back_to_screening_review',
        actionStage: EncounterStage.Lab,
        actionBy: labTechId,
        newValues: { to_stage: EncounterStage.ScreeningReview },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Lab,
      EncounterStage.ScreeningReview,
      labTechId
    )

    return transition
  }
}
