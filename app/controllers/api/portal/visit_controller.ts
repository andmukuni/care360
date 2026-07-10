import type { HttpContext } from '@adonisjs/core/http'
import Encounter from '#models/encounter'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import { labelize, pageParam, paginated, subjectPatient } from './lab_controller.js'
import { labResultResource } from './lab_controller.js'
import { prescriptionResource } from './prescription_controller.js'

/**
 * Visit / encounter history. Ported from App\Http\Controllers\Api\Portal\VisitController.
 */
export default class VisitController {
  private readonly medicalSummary = new PatientMedicalSummaryService()
  private readonly dependentResolver = new PatientDependentResolver()

  async index(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const page = pageParam(ctx)

    const paginator = await this.medicalSummary.paginatedEncounters(patient, 15, page)

    return ctx.response.ok(
      await paginated(ctx, paginator, (e) => encounterSummaryResource(e as Encounter))
    )
  }

  async show(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const encounter = await Encounter.findOrFail(ctx.params.encounter)

    // Ownership is enforced inside the service (403 if not this patient's).
    const loaded = await this.medicalSummary.encounterForPatient(patient, encounter)
    const diagnoses = await this.medicalSummary.diagnosisSummaryForEncounter(loaded)

    return ctx.response.ok({ data: encounterResource(loaded, diagnoses) })
  }
}

/** Reproduces App\Http\Resources\Portal\EncounterSummaryResource. */
export function encounterSummaryResource(encounter: Encounter): Record<string, unknown> {
  const stage = String(encounter.currentStage ?? '')
  const status = String(encounter.currentStatus ?? '')

  return {
    id: encounter.id,
    encounter_number: encounter.encounterNumber,
    visit_type: encounter.visitType,
    stage: stage !== '' ? stage : null,
    stage_label: stage !== '' ? labelize(stage) : null,
    status: status !== '' ? status : null,
    status_label: status !== '' ? labelize(status) : null,
    priority_level: encounter.priorityLevel,
    started_at: encounter.startedAt ? encounter.startedAt.toISO() : null,
    closed_at: encounter.closedAt ? encounter.closedAt.toISO() : null,
    is_closed: stage === 'completed' || encounter.closedAt !== null,
  }
}

/**
 * Reproduces App\Http\Resources\Portal\EncounterResource.
 *
 * `diagnoses` is supplied by the controller (PatientMedicalSummaryService) so the
 * mobile app shows the same human-readable diagnosis labels as the web portal.
 *
 * PORT-GAP: the Laravel resource read singular `triageRecord` / `labRequest` /
 * `prescriptions` relations. The AdonisJS models expose the plural equivalents;
 * vitals use the first triage record and lab results flatten all released results
 * across the encounter's lab requests.
 */
export function encounterResource(
  encounter: Encounter,
  diagnoses: string[] = []
): Record<string, unknown> {
  const stage = String(encounter.currentStage ?? '')
  const status = String(encounter.currentStatus ?? '')
  const triage = encounter.triageRecords?.[0] ?? null

  const payload: Record<string, unknown> = {
    id: encounter.id,
    encounter_number: encounter.encounterNumber,
    visit_type: encounter.visitType,
    stage: stage !== '' ? stage : null,
    stage_label: stage !== '' ? labelize(stage) : null,
    status: status !== '' ? status : null,
    status_label: status !== '' ? labelize(status) : null,
    priority_level: encounter.priorityLevel,
    started_at: encounter.startedAt ? encounter.startedAt.toISO() : null,
    closed_at: encounter.closedAt ? encounter.closedAt.toISO() : null,
    is_closed: stage === 'completed' || encounter.closedAt !== null,
    closure_notes: encounter.closureNotes,

    diagnoses: diagnoses ?? [],

    vitals: triage
      ? {
          recorded_at: triage.triageAt ? triage.triageAt.toISO() : null,
          weight: triage.weight,
          height: triage.height,
          bmi: triage.bmi,
          temperature: triage.temperature,
          pulse: triage.pulse,
          respiratory_rate: triage.respiratoryRate,
          systolic_bp: triage.systolicBp,
          diastolic_bp: triage.diastolicBp,
          oxygen_saturation: triage.oxygenSaturation,
          blood_sugar: triage.bloodSugar,
          pain_scale: triage.painScale,
          chief_complaint: triage.chiefComplaintBrief,
        }
      : null,
  }

  const labRequests = encounter.labRequests
  if (labRequests !== undefined) {
    const results = labRequests.flatMap((request) => request.labResults ?? [])
    payload.lab_results = results.map((result) => labResultResource(result))
  }

  const prescriptions = encounter.pharmacyPrescriptions
  if (prescriptions !== undefined) {
    payload.prescriptions = prescriptions.map((prescription) => prescriptionResource(prescription))
  }

  return payload
}
