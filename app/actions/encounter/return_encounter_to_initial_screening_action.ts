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
import { getLatestDispense } from '#services/encounter/encounter_records'

/**
 * Returns an in-progress Lab or Pharmacy encounter to Screening when the
 * downstream work (lab request / prescription) was never authored.
 */
export default class ReturnEncounterToInitialScreeningAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    actorId: number,
    fromStage: EncounterStage.Lab | EncounterStage.Pharmacy,
    notes: string | null = null
  ): Promise<EncounterQueueTransition> {
    const transition = await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, fromStage)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      if (fromStage === EncounterStage.Pharmacy) {
        const dispense = await getLatestDispense(encounter.id, trx)
        if (dispense) {
          throw new Error(
            'Encounter already has a dispense record and cannot be returned to Screening.'
          )
        }
      }

      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      await this.workflowService.completeStageLog(encounter, actorId, notes, trx)

      const created = await this.queueService.queueTo(
        encounter,
        EncounterStage.Screening,
        actorId,
        notes,
        trx
      )

      await this.workflowService.advanceToStage(
        encounter,
        EncounterStage.Screening,
        EncounterStatus.Queued,
        trx
      )

      await this.auditService.record({
        encounter,
        actionName: 'returned_to_initial_screening',
        actionStage: fromStage,
        actionBy: actorId,
        newValues: { to_stage: EncounterStage.Screening, from_stage: fromStage },
        notes,
        client: trx,
      })

      return created
    })

    await this.notifier.notifyStageTransition(
      encounter,
      fromStage,
      EncounterStage.Screening,
      actorId
    )

    return transition
  }
}
