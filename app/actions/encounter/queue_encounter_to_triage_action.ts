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
 * Completes registration and queues the encounter to Triage.
 * Ported from App\Actions\Encounter\QueueEncounterToTriageAction.
 */
export default class QueueEncounterToTriageAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    queuedBy: number,
    notes: string | null = null
  ): Promise<EncounterQueueTransition> {
    const transition = await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Registration)

      await this.workflowService.completeStageLog(encounter, queuedBy, notes, trx)

      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Triage,
        queuedBy,
        notes,
        trx
      )

      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Triage,
        EncounterStatus.Queued,
        trx
      )

      await this.auditService.record({
        encounter,
        actionName: 'queued_to_triage',
        actionStage: EncounterStage.Registration,
        actionBy: queuedBy,
        newValues: { to_stage: EncounterStage.Triage },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Registration,
      EncounterStage.Triage,
      queuedBy
    )

    return transition
  }
}
