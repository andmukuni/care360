import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import ScreeningVitalRecheck from '#models/screening_vital_recheck'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getReviewScreeningRecord } from '#services/encounter/encounter_records'
import { arrayFilter } from '#support/encounter/coerce'

/**
 * Records a vital signs recheck during screening review (post-lab). Requires
 * an existing review_after_lab screening record. Sibling of
 * RecordScreeningVitalRecheckAction, scoped to the ScreeningReview stage.
 */
export default class RecordScreeningReviewVitalRecheckAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    recordedBy: number
  ): Promise<ScreeningVitalRecheck> {
    return db.transaction(async (trx) => {
      const screeningRecord = await getReviewScreeningRecord(encounter.id, trx)

      if (!screeningRecord) {
        throw new Error('Save the clinical review before recording a vital recheck.')
      }

      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.ScreeningReview)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const recheck = await ScreeningVitalRecheck.create(
        {
          screeningRecordId: screeningRecord.id,
          encounterId: encounter.id,
          weight: data.weight ?? null,
          height: data.height ?? null,
          bpSystolic: data.bp_systolic ?? null,
          bpDiastolic: data.bp_diastolic ?? null,
          pulse: data.pulse ?? null,
          temperature: data.temperature ?? null,
          spo2: data.spo2 ?? null,
          notes: data.notes ?? null,
          recordedBy,
        },
        { client: trx }
      )

      await this.auditService.record({
        encounter,
        actionName: 'screening_review_vital_recheck',
        actionStage: EncounterStage.ScreeningReview,
        actionBy: recordedBy,
        newValues: arrayFilter({
          weight: data.weight ?? null,
          height: data.height ?? null,
          bp_systolic: data.bp_systolic ?? null,
          bp_diastolic: data.bp_diastolic ?? null,
          pulse: data.pulse ?? null,
          temperature: data.temperature ?? null,
          spo2: data.spo2 ?? null,
          notes: data.notes ?? null,
        }),
        client: trx,
      })

      return recheck
    })
  }
}
