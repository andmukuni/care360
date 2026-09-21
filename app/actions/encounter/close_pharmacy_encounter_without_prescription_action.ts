import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import EncounterStageLog from '#models/encounter_stage_log'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterNotifier } from '#services/encounter/encounter_notifier'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { staffQueueBroadcast } from '#services/staff/staff_queue_broadcast_service'
import {
  PHARMACY_NO_PRESCRIPTION_CLOSURE_NOTE,
  hasPrescriptionWithItems,
  isPharmacyEncounterCloseableWithoutPrescription,
} from '#support/encounter/stage_prerequisites'

/**
 * Closes a Pharmacy encounter that has no prescription medication.
 * Used for leftover queued/in-progress rows that should never have reached Pharmacy.
 */
export default class ClosePharmacyEncounterWithoutPrescriptionAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly queueService = new EncounterQueueService()
  private readonly notifier = new EncounterNotifier()

  async handle(
    encounter: Encounter,
    actorId: number,
    closureNotes: string | null = PHARMACY_NO_PRESCRIPTION_CLOSURE_NOTE
  ): Promise<void> {
    await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Pharmacy)

      const hasItems = await hasPrescriptionWithItems(encounter.id, trx)
      if (
        !isPharmacyEncounterCloseableWithoutPrescription({
          stage: encounter.currentStage,
          status: encounter.currentStatus,
          isLocked: encounter.isLocked,
          hasPrescriptionItems: hasItems,
        })
      ) {
        throw new Error(
          hasItems
            ? 'Encounter has prescription medication and cannot be auto-closed.'
            : `Encounter ${encounter.encounterNumber} is not an open Pharmacy visit.`
        )
      }

      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      const openLog = await EncounterStageLog.query({ client: trx })
        .where('encounter_id', encounter.id)
        .where('stage_name', EncounterStage.Pharmacy)
        .whereNull('completed_at')
        .orderBy('id', 'desc')
        .first()

      if (openLog) {
        openLog.useTransaction(trx)
        openLog.status = QueueTransitionStatus.Completed
        openLog.completedBy = actorId
        openLog.completedAt = DateTime.now()
        openLog.notes = closureNotes ?? openLog.notes
        await openLog.save()
      }

      encounter.useTransaction(trx)
      encounter.currentStage = EncounterStage.Completed
      encounter.currentStatus = EncounterStatus.Completed
      encounter.closedAt = DateTime.now()
      encounter.closedBy = actorId
      encounter.closureNotes = closureNotes
      await encounter.save()

      await this.lockService.lock(encounter, trx)

      await this.auditService.record({
        encounter,
        actionName: 'encounter_closed_from_pharmacy_without_prescription',
        actionStage: EncounterStage.Completed,
        actionBy: actorId,
        notes: closureNotes,
        client: trx,
      })

      staffQueueBroadcast.notifyStages([EncounterStage.Pharmacy, EncounterStage.Completed], trx)
    })

    await this.notifier.notifyClosure(encounter, actorId)
  }
}
