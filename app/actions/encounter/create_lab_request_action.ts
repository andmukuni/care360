import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Encounter from '#models/encounter'
import LabRequest from '#models/lab_request'
import LabSpecimenType from '#models/lab_specimen_type'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getInitialScreeningRecord, getLabRequest } from '#services/encounter/encounter_records'

/**
 * Creates (or updates) a clinician-authored LabRequest at the screening stage.
 * Idempotent: re-running replaces the items so the clinician can revise before
 * the request leaves screening.
 * Ported from App\Actions\Encounter\CreateLabRequestAction.
 */
export default class CreateLabRequestAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    clinicianId: number
  ): Promise<LabRequest> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Screening)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const screeningRecord = await getInitialScreeningRecord(encounter.id, trx)

      if (!screeningRecord) {
        throw new Error(
          'A screening assessment must be saved before a lab request can be authored.'
        )
      }

      if (!screeningRecord.labRequested) {
        throw new Error(
          'The screening record must have lab_requested = true before authoring a lab request.'
        )
      }

      const existing = await getLabRequest(encounter.id, trx)

      let labRequest: LabRequest
      if (existing) {
        labRequest = existing
        labRequest.useTransaction(trx)
        labRequest.priorityLevel = data.priority_level ?? existing.priorityLevel ?? 'normal'
        labRequest.requestNotes = data.request_notes ?? existing.requestNotes
        labRequest.requestedBy = clinicianId
        labRequest.requestedAt = DateTime.now()
        labRequest.status = 'pending'
        await labRequest.save()

        await labRequest.related('labRequestItems').query().delete()
      } else {
        labRequest = await LabRequest.create(
          {
            encounterId: encounter.id,
            patientId: encounter.patientId,
            screeningRecordId: screeningRecord.id,
            requestedBy: clinicianId,
            requestNumber: await this.generateRequestNumber(trx),
            priorityLevel: data.priority_level ?? encounter.priorityLevel ?? 'normal',
            requestNotes: data.request_notes ?? null,
            status: 'pending',
            requestedAt: DateTime.now(),
          },
          { client: trx }
        )
      }

      labRequest.useTransaction(trx)

      for (const item of data.items ?? []) {
        let sid: number | null =
          item.lab_specimen_type_id !== undefined && item.lab_specimen_type_id !== null
            ? Number(item.lab_specimen_type_id)
            : null

        if (sid) {
          const exists = await LabSpecimenType.find(sid, { client: trx })
          if (!exists) {
            sid = null
          }
        }

        let specimenLabel: string | null = item.specimen_type ?? null
        if (sid) {
          const catalog = await LabSpecimenType.find(sid, { client: trx })
          if (catalog) {
            specimenLabel = catalog.defaultUnit
              ? `${catalog.name} (${catalog.defaultUnit})`
              : catalog.name
          }
        }

        await labRequest.related('labRequestItems').create({
          testName: item.test_name,
          testCode: item.test_code ?? null,
          specimenType: specimenLabel,
          labSpecimenTypeId: sid ? sid : null,
          testGroup: item.test_group ?? null,
          instructions: item.instructions ?? null,
          status: 'pending',
        })
      }

      await this.auditService.record({
        encounter,
        actionName: 'lab_request_authored',
        actionStage: EncounterStage.Screening,
        actionBy: clinicianId,
        newValues: {
          lab_request_number: labRequest.requestNumber,
          priority_level: labRequest.priorityLevel,
          item_count: (data.items ?? []).length,
        },
        notes: data.request_notes ?? null,
        client: trx,
      })

      await labRequest.refresh()
      await labRequest.load('labRequestItems')

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
    const seq = String(count + 1).padStart(4, '0')

    return `LAB-${date}-${seq}`
  }
}
