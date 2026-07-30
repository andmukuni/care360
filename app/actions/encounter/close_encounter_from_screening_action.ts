import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterNotifier } from '#services/encounter/encounter_notifier'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { staffQueueBroadcast } from '#services/staff/staff_queue_broadcast_service'

/**
 * Ends an encounter at Screening without queueing to Lab / Pharmacy / Treatment.
 */
export default class CloseEncounterFromScreeningAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly queueService = new EncounterQueueService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    clinicianId: number,
    closureNotes: string | null = null
  ): Promise<void> {
    await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Screening)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      await this.workflowService.completeStageLog(encounter, clinicianId, closureNotes, trx)

      encounter.useTransaction(trx)
      encounter.currentStage = EncounterStage.Completed
      encounter.currentStatus = EncounterStatus.Completed
      encounter.closedAt = DateTime.now()
      encounter.closedBy = clinicianId
      encounter.closureNotes = closureNotes
      await encounter.save()

      await this.lockService.lock(encounter, trx)

      await this.auditService.record({
        encounter,
        actionName: 'encounter_closed_from_screening',
        actionStage: EncounterStage.Completed,
        actionBy: clinicianId,
        notes: closureNotes,
        client: trx,
      })

      staffQueueBroadcast.notifyStages([EncounterStage.Screening, EncounterStage.Completed], trx)
    })

    await this.notifier.notifyStageTransition(
      encounter,
      EncounterStage.Screening,
      EncounterStage.Completed,
      clinicianId
    )
  }
}
