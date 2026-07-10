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
 * Completes initial screening and queues the encounter to Lab.
 * Ported from App\Actions\Encounter\QueueEncounterToLabAction.
 */
export default class QueueEncounterToLabAction {
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
        throw new Error('A screening assessment must be recorded before queuing to Lab.')
      }

      if (!screeningRecord.labRequested) {
        throw new Error('Lab must be requested on the screening record before queuing to Lab.')
      }

      // 1. Stamp lab referral + completion on the screening record.
      screeningRecord.useTransaction(trx)
      screeningRecord.referredToLabAt = DateTime.now()
      screeningRecord.screeningCompletedAt = DateTime.now()
      await screeningRecord.save()

      // 2. Complete the incoming (triage → screening) transition.
      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      // 3. Close the screening stage log.
      await this.workflowService.completeStageLog(encounter, clinicianId, notes, trx)

      // 4. Create screening → lab transition.
      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Lab,
        clinicianId,
        notes,
        trx
      )

      // 5. Advance encounter to lab.
      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Lab,
        EncounterStatus.Queued,
        trx
      )

      // 6. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'queued_to_lab',
        actionStage: EncounterStage.Screening,
        actionBy: clinicianId,
        newValues: { to_stage: EncounterStage.Lab },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Screening,
      EncounterStage.Lab,
      clinicianId
    )

    return transition
  }
}
