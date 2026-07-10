import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import ScreeningRecord from '#models/screening_record'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'

/**
 * Records the post-lab clinical review as a second ScreeningRecord with
 * screening_type = 'review_after_lab'.
 * Ported from App\Actions\Encounter\RecordScreeningReviewAction.
 */
export default class RecordScreeningReviewAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    clinicianId: number
  ): Promise<ScreeningRecord> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.ScreeningReview)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const existing = await ScreeningRecord.query({ client: trx })
        .where('encounter_id', encounter.id)
        .where('screening_type', 'review_after_lab')
        .orderBy('id', 'desc')
        .first()

      const record = existing
        ? await existing
            .merge({
              clinicianId,
              finalDiagnosis: data.final_diagnosis ?? null,
              clinicalFindings: data.clinical_findings ?? null,
              physicalExamination: data.physical_examination ?? null,
              assessmentNotes: data.assessment_notes ?? null,
              plan: data.plan ?? null,
              reviewNotes: data.review_notes ?? null,
              prescribed: false,
              screeningCompletedAt: DateTime.now(),
            })
            .useTransaction(trx)
            .save()
        : await ScreeningRecord.create(
            {
              encounterId: encounter.id,
              patientId: encounter.patientId,
              clinicianId,
              screeningType: 'review_after_lab',
              finalDiagnosis: data.final_diagnosis ?? null,
              clinicalFindings: data.clinical_findings ?? null,
              physicalExamination: data.physical_examination ?? null,
              assessmentNotes: data.assessment_notes ?? null,
              plan: data.plan ?? null,
              reviewNotes: data.review_notes ?? null,
              prescribed: false,
              screeningStartedAt: DateTime.now(),
              screeningCompletedAt: DateTime.now(),
            },
            { client: trx }
          )

      await this.auditService.record({
        encounter,
        actionName: 'screening_review_completed',
        actionStage: EncounterStage.ScreeningReview,
        actionBy: clinicianId,
        client: trx,
      })

      return record
    })
  }
}
