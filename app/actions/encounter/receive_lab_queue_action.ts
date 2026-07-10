import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Encounter from '#models/encounter'
import LabRequest from '#models/lab_request'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getInitialScreeningRecord, getLabRequest } from '#services/encounter/encounter_records'

/**
 * Receives a patient into Lab from the screening queue, creating/re-using the
 * LabRequest that lab staff work from.
 * Ported from App\Actions\Encounter\ReceiveLabQueueAction.
 */
export default class ReceiveLabQueueAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly queueService = new EncounterQueueService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(encounter: Encounter, labTechId: number): Promise<LabRequest> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Lab)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.Queued)

      // 1. Mark the incoming transition (screening → lab) as received.
      const transition = await this.queueService.getOpenTransition(encounter, trx)
      if (transition) {
        await this.queueService.receive(transition, labTechId, trx)
      }

      // 2. Open the lab stage log.
      await this.workflowService.openStageLog(encounter, labTechId, null, {}, trx)

      // 3. Create the LabRequest if one doesn't already exist; otherwise promote
      //    the clinician-authored request (keeping items/priority/notes intact).
      const screeningRecord = await getInitialScreeningRecord(encounter.id, trx)
      let labRequest = await getLabRequest(encounter.id, trx)

      if (labRequest) {
        labRequest.useTransaction(trx)
        labRequest.status = 'in_progress'
        await labRequest.save()
      } else {
        labRequest = await LabRequest.create(
          {
            encounterId: encounter.id,
            patientId: encounter.patientId,
            screeningRecordId: screeningRecord?.id ?? null,
            requestedBy: labTechId,
            requestNumber: await this.generateRequestNumber(trx),
            priorityLevel: encounter.priorityLevel,
            status: 'in_progress',
            requestedAt: DateTime.now(),
          },
          { client: trx }
        )
      }

      // 4. Set encounter in-progress.
      await this.workflowService.markInProgress(encounter, trx)

      // 5. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'lab_received',
        actionStage: EncounterStage.Lab,
        actionBy: labTechId,
        newValues: { lab_request_number: labRequest.requestNumber },
        client: trx,
      })

      return labRequest
    })
  }

  private async generateRequestNumber(client: TransactionClientContract): Promise<string> {
    const date = DateTime.now().toFormat('yyyyLLdd')
    const start = DateTime.now().startOf('day').toISO()!
    const end = DateTime.now().endOf('day').toISO()!

    const result = await LabRequest.query({ client })
      .where('created_at', '>=', start)
      .where('created_at', '<=', end)
      .count('* as total')

    const count = Number(result[0].$extras.total)

    return `LAB-${date}-${String(count + 1).padStart(4, '0')}`
  }
}
