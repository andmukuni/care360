import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import type EncounterQueueTransition from '#models/encounter_queue_transition'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterNotifier } from '#services/encounter/encounter_notifier'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getLatestPrescription } from '#services/encounter/encounter_records'

/**
 * Completes Screening Review and queues the encounter to Pharmacy.
 * Ported from App\Actions\Encounter\QueueEncounterToPharmacyAction.
 */
export default class QueueEncounterToPharmacyAction {
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

      const prescription = await getLatestPrescription(encounter.id, trx)
      const hasItems = prescription
        ? (await PharmacyPrescriptionItem.query({ client: trx })
            .where('pharmacy_prescription_id', prescription.id)
            .first()) !== null
        : false

      if (!prescription || !hasItems) {
        throw new Error(
          'A prescription with at least one item is required before queuing to Pharmacy.'
        )
      }

      await this.workflowService.completeStageLog(encounter, clinicianId, notes, trx)

      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Pharmacy,
        clinicianId,
        notes,
        trx
      )

      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Pharmacy,
        EncounterStatus.Queued,
        trx
      )

      await this.auditService.record({
        encounter,
        actionName: 'queued_to_pharmacy',
        actionStage: EncounterStage.Pharmacy,
        actionBy: clinicianId,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.ScreeningReview,
      EncounterStage.Pharmacy,
      clinicianId
    )

    return transition
  }
}
