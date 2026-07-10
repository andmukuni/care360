import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import TriageRecord from '#models/triage_record'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { arrayFilter } from '#support/encounter/coerce'

/**
 * Records triage vitals and clinical notes. Upserts on the encounter.
 * Does NOT advance the stage (that is QueueEncounterToScreeningAction).
 * Ported from App\Actions\Encounter\RecordTriageAction.
 */
export default class RecordTriageAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    nurseId: number
  ): Promise<TriageRecord> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Triage)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const bmi = this.computeBmi(data.weight ?? null, data.height ?? null)

      const record = await TriageRecord.updateOrCreate(
        { encounterId: encounter.id },
        {
          patientId: encounter.patientId,
          nurseId,
          weight: data.weight ?? null,
          height: data.height ?? null,
          bmi,
          temperature: data.temperature ?? null,
          pulse: data.pulse ?? null,
          respiratoryRate: data.respiratory_rate ?? null,
          systolicBp: data.systolic_bp ?? null,
          diastolicBp: data.diastolic_bp ?? null,
          oxygenSaturation: data.oxygen_saturation ?? null,
          bloodSugar: data.blood_sugar ?? null,
          painScale: data.pain_scale ?? null,
          muac: data.muac ?? null,
          muacScore: data.muac_score ?? null,
          abdominalCircumference: data.abdominal_circumference ?? null,
          chiefComplaintBrief: data.chief_complaint_brief ?? null,
          startupInterventionsNotes: data.startup_interventions_notes ?? null,
          startupMedicationsNotes: data.startup_medications_notes ?? null,
          triageNotes: data.triage_notes ?? null,
          triageAt: DateTime.now(),
        },
        { client: trx }
      )

      await this.auditService.record({
        encounter,
        actionName: 'triage_vitals_recorded',
        actionStage: EncounterStage.Triage,
        actionBy: nurseId,
        newValues: arrayFilter({
          weight: data.weight ?? null,
          temperature: data.temperature ?? null,
          pulse: data.pulse ?? null,
          bmi,
        }),
        client: trx,
      })

      return record
    })
  }

  private computeBmi(weight: unknown, height: unknown): number | null {
    const w = weight === null || weight === undefined ? null : Number(weight)
    const h = height === null || height === undefined ? null : Number(height)
    if (!w || !h || h <= 0) {
      return null
    }
    const heightM = h / 100
    return Math.round((w / (heightM * heightM)) * 100) / 100
  }
}
