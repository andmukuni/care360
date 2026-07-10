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
import { getTriageRecord } from '#services/encounter/encounter_records'

/**
 * Completes triage and queues the encounter to Screening.
 * Ported from App\Actions\Encounter\QueueEncounterToScreeningAction.
 */
export default class QueueEncounterToScreeningAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    nurseId: number,
    notes: string | null = null
  ): Promise<EncounterQueueTransition> {
    const transition = await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Triage)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      // Guard: triage record must exist before completing.
      const triageRecord = await getTriageRecord(encounter.id, trx)
      if (!triageRecord) {
        throw new Error('Triage vitals must be recorded before queuing to Screening.')
      }

      // 1. Complete the open (received) triage transition.
      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      // 2. Stamp completed_at on the triage record.
      triageRecord.useTransaction(trx)
      triageRecord.completedAt = DateTime.now()
      await triageRecord.save()

      // 3. Close the triage stage log.
      await this.workflowService.completeStageLog(encounter, nurseId, notes, trx)

      // 4. Create triage → screening transition.
      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Screening,
        nurseId,
        notes,
        trx
      )

      // 5. Advance encounter.
      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Screening,
        EncounterStatus.Queued,
        trx
      )

      // 6. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'queued_to_screening',
        actionStage: EncounterStage.Triage,
        actionBy: nurseId,
        newValues: { to_stage: EncounterStage.Screening },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Triage,
      EncounterStage.Screening,
      nurseId
    )

    return transition
  }
}
