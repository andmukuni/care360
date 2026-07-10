import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import ScreeningRecord from '#models/screening_record'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { arrayFilter, toBoolOrNull, toDateTime } from '#support/encounter/coerce'
import GeneratePresumptiveTbCaseNumberAction from '#actions/encounter/generate_presumptive_tb_case_number_action'

/**
 * Saves (or updates) the initial screening clinical record. Does NOT advance
 * the stage. Supports upsert so the clinician can revise before completing.
 * Ported from App\Actions\Encounter\RecordInitialScreeningAction.
 *
 * The EDD auto-derivation mirrors GynObsAlertService::calculateEdd (LMP + 280
 * days); it is inlined here to avoid a cross-phase dependency.
 */
export default class RecordInitialScreeningAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly generateTbCaseNumberAction = new GeneratePresumptiveTbCaseNumberAction()

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    clinicianId: number
  ): Promise<ScreeningRecord> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Screening)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      let presumptiveTbCaseNo: string | null = data.presumptive_tb_case_no ?? null
      const hasTbSymptoms = !!data.tb_symptoms
      const hasConstitutionalSymptoms = this.filled(data.constitutional_symptoms)

      if ((hasConstitutionalSymptoms || hasTbSymptoms) && this.blank(presumptiveTbCaseNo)) {
        presumptiveTbCaseNo = await this.generateTbCaseNumberAction.handle()
      }

      const record = await ScreeningRecord.updateOrCreate(
        { encounterId: encounter.id },
        {
          patientId: encounter.patientId,
          clinicianId,
          screeningType: 'initial',
          // Complaints & Histories
          complaints: data.complaints ?? null,
          tbSymptoms: data.tb_symptoms ?? null,
          constitutionalSymptoms: data.constitutional_symptoms ?? null,
          presumptiveTbCaseNo,
          reviewOfSystems: data.review_of_systems ?? null,
          historyOfPresentingIllness: data.history_of_presenting_illness ?? null,
          pastMedicalHistory: data.past_medical_history ?? null,
          medicationHistory: data.medication_history ?? null,
          allergyHistory: data.allergy_history ?? null,
          chronicConditions: data.chronic_conditions ?? null,
          familyHistory: data.family_history ?? null,
          socialHistory: data.social_history ?? null,
          // Paediatric History
          birthWeight: data.birth_weight ?? null,
          birthLength: data.birth_length ?? null,
          headCircumference: data.head_circumference ?? null,
          chestCircumference: data.chest_circumference ?? null,
          generalCondition: data.general_condition ?? null,
          isBreastFeedingWell: toBoolOrNull(data.is_breast_feeding_well),
          otherFeedingOption: data.other_feeding_option ?? null,
          deliveryTime: data.delivery_time ?? null,
          vaccinationOutside: data.vaccination_outside ?? null,
          tetanusAtBirth: data.tetanus_at_birth ?? null,
          birthOutcome: data.birth_outcome ?? null,
          birthNotes: data.birth_notes ?? null,
          immunizationHistory: data.immunization_history ?? null,
          feedingCode: data.feeding_code ?? null,
          feedingComments: data.feeding_comments ?? null,
          developmentHistory: data.development_history ?? null,
          // Examination & Diagnosis
          physicalExamination: data.physical_examination ?? null,
          clinicalFindings: data.clinical_findings ?? null,
          provisionalDiagnosis: data.provisional_diagnosis ?? null,
          finalDiagnosis: data.final_diagnosis ?? null,
          assessmentNotes: data.assessment_notes ?? null,
          // Plan
          plan: data.plan ?? null,
          treatmentPlan: data.treatment_plan ?? null,
          labRequested: Boolean(data.lab_requested ?? false),
          screeningStartedAt: DateTime.now(),
          // Gyn & OBS — Menstrual History
          menstrualCycleRegularity: data.menstrual_cycle_regularity ?? null,
          cycleLengthDays: data.cycle_length_days ?? null,
          durationOfFlowDays: data.duration_of_flow_days ?? null,
          lastMenstrualPeriod: toDateTime(data.last_menstrual_period ?? null),
          dysmenorrhoea: toBoolOrNull(data.dysmenorrhoea),
          intermenstrualBleeding: toBoolOrNull(data.intermenstrual_bleeding),
          postCoitalBleeding: toBoolOrNull(data.post_coital_bleeding),
          menstrualNotes: data.menstrual_notes ?? null,
          // Gyn & OBS — Obstetrics History
          gravida: data.gravida ?? null,
          para: data.para ?? null,
          abortus: data.abortus ?? null,
          livingChildren: data.living_children ?? null,
          currentlyPregnant: toBoolOrNull(data.currently_pregnant),
          expectedDeliveryDate: toDateTime(data.expected_delivery_date ?? null),
          previousObstetricComplications: data.previous_obstetric_complications ?? null,
          obstetricsNotes: data.obstetrics_notes ?? null,
          // Gyn & OBS — Contraceptive History
          usingContraception: toBoolOrNull(data.using_contraception),
          contraceptiveMethod: data.contraceptive_method ?? null,
          contraceptiveMethodOther: data.contraceptive_method_other ?? null,
          contraceptiveDurationMonths: data.contraceptive_duration_months ?? null,
          previousContraceptiveMethods: data.previous_contraceptive_methods ?? null,
          contraceptiveNotes: data.contraceptive_notes ?? null,
          // Gyn & OBS — Cervical Cancer History
          cervicalScreeningDone: toBoolOrNull(data.cervical_screening_done),
          cervicalScreeningDate: toDateTime(data.cervical_screening_date ?? null),
          cervicalScreeningMethod: data.cervical_screening_method ?? null,
          cervicalScreeningResult: data.cervical_screening_result ?? null,
          cervicalScreeningResultNotes: data.cervical_screening_result_notes ?? null,
          cervicalTreatmentDone: toBoolOrNull(data.cervical_treatment_done),
          cervicalTreatmentType: data.cervical_treatment_type ?? null,
          cervicalCancerNotes: data.cervical_cancer_notes ?? null,
        },
        { client: trx }
      )

      record.useTransaction(trx)

      // Auto-derive EDD from LMP when pregnant and EDD not supplied.
      if (
        (data.currently_pregnant ?? false) &&
        data.last_menstrual_period &&
        !data.expected_delivery_date
      ) {
        const lmp = toDateTime(data.last_menstrual_period)
        const edd = lmp ? lmp.plus({ days: 280 }) : null
        if (edd !== null) {
          record.expectedDeliveryDate = edd
          await record.save()
        }
      }

      // Sync staff assignments if provided (idempotent when clinician revises).
      if (Array.isArray(data.staff_assignments) && data.staff_assignments.length > 0) {
        await record.related('screeningStaffAssignments').query().delete()

        for (const assignment of data.staff_assignments) {
          await record.related('screeningStaffAssignments').create({
            userId: assignment.user_id,
            roleName: assignment.role_name ?? null,
            participationType: assignment.participation_type ?? null,
            notes: assignment.notes ?? null,
          })
        }
      }

      await this.auditService.record({
        encounter,
        actionName: 'screening_assessment_recorded',
        actionStage: EncounterStage.Screening,
        actionBy: clinicianId,
        newValues: arrayFilter({
          provisional_diagnosis: data.provisional_diagnosis ?? null,
          lab_requested: data.lab_requested ?? false,
        }),
        client: trx,
      })

      return record
    })
  }

  private filled(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim() !== ''
    return true
  }

  private blank(value: unknown): boolean {
    return !this.filled(value)
  }
}
