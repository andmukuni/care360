import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import EncounterStageLog from '#models/encounter_stage_log'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { staffQueueBroadcast } from '#services/staff/staff_queue_broadcast_service'

/**
 * Super-admin override: move an encounter to any active stage and open it for
 * immediate recording (in_progress, received by the admin).
 */
export default class AdminMoveEncounterToStageAction {
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly queueService = new EncounterQueueService()
  private readonly workflowService = new EncounterWorkflowService()

  async handle(
    encounter: Encounter,
    targetStage: EncounterStage,
    actorId: number,
    notes: string | null = null
  ): Promise<Encounter> {
    if (EncounterStageHelper.isTerminal(targetStage)) {
      throw new Error('Cannot move an encounter to the Completed stage.')
    }

    return db.transaction(async (trx) => {
      const fromStage = encounter.currentStage
      const oldValues = {
        current_stage: encounter.currentStage,
        current_status: encounter.currentStatus,
        is_locked: encounter.isLocked,
        closed_at: encounter.closedAt?.toISO() ?? null,
      }

      // Already on the target stage — take over / open for recording.
      if (fromStage === targetStage && !encounter.isLocked) {
        if (
          targetStage !== EncounterStage.Registration &&
          encounter.currentStatus === EncounterStatus.Queued
        ) {
          const openTransition = await this.queueService.getOpenTransition(encounter, trx)
          if (openTransition) {
            await this.queueService.receive(openTransition, actorId, trx)
          }
          await this.workflowService.openStageLog(
            encounter,
            actorId,
            notes ?? 'Opened by super-admin for recording.',
            { admin_move: true },
            trx
          )
          await this.workflowService.markInProgress(encounter, trx)
        } else if (
          targetStage !== EncounterStage.Registration &&
          encounter.currentStatus === EncounterStatus.InProgress
        ) {
          const openTransition = await this.queueService.getOpenTransition(encounter, trx)
          if (openTransition && Number(openTransition.receivedBy) !== Number(actorId)) {
            openTransition.useTransaction(trx)
            openTransition.receivedBy = actorId
            openTransition.receivedAt = DateTime.now()
            openTransition.status = QueueTransitionStatus.Received
            await openTransition.save()
          }
        }

        await this.auditService.record({
          encounter,
          actionName: 'admin_took_over_stage',
          actionStage: targetStage,
          actionBy: actorId,
          oldValues,
          newValues: {
            current_stage: targetStage,
            current_status: encounter.currentStatus,
          },
          notes: notes ?? 'Super-admin took over stage for recording.',
          client: trx,
        })

        staffQueueBroadcast.notifyStages([targetStage], trx)
        return encounter
      }

      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      const openLog = await EncounterStageLog.query({ client: trx })
        .where('encounter_id', encounter.id)
        .where('stage_name', encounter.currentStage)
        .whereNull('completed_at')
        .orderBy('id', 'desc')
        .first()

      if (openLog) {
        openLog.useTransaction(trx)
        openLog.status = QueueTransitionStatus.Completed
        openLog.completedBy = actorId
        openLog.completedAt = DateTime.now()
        openLog.notes = notes ?? openLog.notes
        await openLog.save()
      }

      if (encounter.isLocked || encounter.currentStage === EncounterStage.Completed) {
        await this.lockService.unlock(encounter, trx)
        encounter.useTransaction(trx)
        encounter.closedAt = null
        encounter.closedBy = null
        encounter.closureNotes = null
        await encounter.save()
      }

      let createdTransition = null
      if (targetStage !== EncounterStage.Registration) {
        createdTransition = await this.queueService.queueTo(
          encounter,
          targetStage,
          actorId,
          notes ?? `Super-admin moved encounter to ${EncounterStageHelper.label(targetStage)}.`,
          trx
        )
      }

      encounter.useTransaction(trx)
      encounter.currentStage = targetStage
      encounter.currentStatus =
        targetStage === EncounterStage.Registration
          ? EncounterStatus.Started
          : EncounterStatus.Queued
      await encounter.save()

      if (createdTransition) {
        await this.queueService.receive(createdTransition, actorId, trx)
      }

      await this.workflowService.openStageLog(
        encounter,
        actorId,
        notes ?? `Opened by super-admin for recording at ${EncounterStageHelper.label(targetStage)}.`,
        { admin_move: true },
        trx
      )

      if (targetStage !== EncounterStage.Registration) {
        await this.workflowService.markInProgress(encounter, trx)
      }

      const finalStatus =
        targetStage === EncounterStage.Registration
          ? EncounterStatus.Started
          : EncounterStatus.InProgress

      await this.auditService.record({
        encounter,
        actionName: 'admin_moved_to_stage',
        actionStage: targetStage,
        actionBy: actorId,
        oldValues,
        newValues: {
          current_stage: targetStage,
          current_status: finalStatus,
          is_locked: false,
        },
        notes:
          notes ??
          `Super-admin moved encounter from ${EncounterStageHelper.label(fromStage)} to ${EncounterStageHelper.label(targetStage)}.`,
        client: trx,
      })

      staffQueueBroadcast.notifyStages([fromStage, targetStage], trx)

      return encounter
    })
  }
}

export function stageWorkspaceUrl(stage: EncounterStage, encounterId: number): string {
  const routes: Partial<Record<EncounterStage, string>> = {
    [EncounterStage.Registration]: `/registration/encounters/${encounterId}`,
    [EncounterStage.Triage]: `/triage/${encounterId}`,
    [EncounterStage.Screening]: `/screening/${encounterId}`,
    [EncounterStage.Lab]: `/lab/${encounterId}`,
    [EncounterStage.ScreeningReview]: `/screening-review/${encounterId}`,
    [EncounterStage.Pharmacy]: `/pharmacy/${encounterId}`,
    [EncounterStage.TreatmentRoom]: `/treatment-room/${encounterId}`,
  }
  return routes[stage] ?? `/encounters/${encounterId}`
}
