import { DateTime } from 'luxon'
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
import { getInitialScreeningRecord } from '#services/encounter/encounter_records'

/**
 * Completes screening and queues the encounter directly to Pharmacy (no lab).
 * Ported from App\Actions\Encounter\QueueEncounterToPharmacyFromScreeningAction.
 */
export default class QueueEncounterToPharmacyFromScreeningAction {
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
      this.workflowService.assertStageIs(encounter, EncounterStage.Screening)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const screeningRecord = await getInitialScreeningRecord(encounter.id, trx)
      if (!screeningRecord) {
        throw new Error('A screening assessment must be recorded before queuing to Pharmacy.')
      }

      // Guard: if lab was requested, use QueueEncounterToLabAction instead.
      if (screeningRecord.labRequested) {
        throw new Error(
          'Lab has been requested — cannot queue directly to Pharmacy. Use QueueEncounterToLabAction.'
        )
      }

      // 1. Stamp the screening record.
      screeningRecord.useTransaction(trx)
      screeningRecord.prescribed = true
      screeningRecord.screeningCompletedAt = DateTime.now()
      await screeningRecord.save()

      // 2. Complete the open incoming transition.
      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      // 3. Close the screening stage log.
      await this.workflowService.completeStageLog(encounter, clinicianId, notes, trx)

      // 4. Create screening → pharmacy transition.
      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Pharmacy,
        clinicianId,
        notes,
        trx
      )

      // 5. Advance encounter to pharmacy.
      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Pharmacy,
        EncounterStatus.Queued,
        trx
      )

      // 6. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'queued_to_pharmacy_direct',
        actionStage: EncounterStage.Screening,
        actionBy: clinicianId,
        newValues: { to_stage: EncounterStage.Pharmacy, lab_skipped: true },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Screening,
      EncounterStage.Pharmacy,
      clinicianId
    )

    return transition
  }
}
