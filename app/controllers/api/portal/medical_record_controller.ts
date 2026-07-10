import type { HttpContext } from '@adonisjs/core/http'
import BedAssignment from '#models/bed_assignment'
import DischargeSummary from '#models/discharge_summary'
import LabRequest from '#models/lab_request'
import ScreeningRecord from '#models/screening_record'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import DiagnosisFormatter from '#services/portal/diagnosis_formatter'
import { labelize, pageParam, paginated, subjectPatient } from './lab_controller.js'
import { labResultResource } from './lab_controller.js'

/**
 * Health records. Ported from App\Http\Controllers\Api\Portal\MedicalRecordController.
 */
export default class MedicalRecordController {
  private readonly medicalSummary = new PatientMedicalSummaryService()
  private readonly dependentResolver = new PatientDependentResolver()

  async summary(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)

    return ctx.response.ok({
      latest_vitals: await this.medicalSummary.latestVitals(patient),
    })
  }

  async medicalHistory(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const page = pageParam(ctx)

    const paginator = await this.medicalSummary.paginatedDiagnoses(patient, 20, page)

    return ctx.response.ok(
      await paginated(ctx, paginator, (r) => medicalHistoryResource(r as ScreeningRecord))
    )
  }

  async labRequests(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const page = pageParam(ctx)

    const paginator = await this.medicalSummary.paginatedLabRequests(patient, 20, page)

    return ctx.response.ok(
      await paginated(ctx, paginator, (r) => labRequestResource(r as LabRequest))
    )
  }

  async labRequestShow(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const labRequest = await LabRequest.findOrFail(ctx.params.labRequest)

    const result = await this.medicalSummary.labRequestForPatient(patient, labRequest)

    return ctx.response.ok({ data: labRequestResource(result) })
  }

  async admissions(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const page = pageParam(ctx)

    const admissions = await this.medicalSummary.paginatedAdmissions(patient, 15, page)
    const dischargeSummaries = await this.medicalSummary.dischargeSummariesForPatient(patient)

    return ctx.response.ok({
      admissions: admissions.all().map((row) => admissionResource(row)),
      discharge_summaries: dischargeSummaries.map((row) => dischargeSummaryResource(row)),
    })
  }
}

/** Reproduces App\Http\Resources\Portal\MedicalHistoryResource. */
export function medicalHistoryResource(record: ScreeningRecord): Record<string, unknown> {
  const final = DiagnosisFormatter.format(record.finalDiagnosis)
  const provisional = DiagnosisFormatter.format(record.provisionalDiagnosis)

  return {
    id: record.id,
    final_diagnosis: final !== '' ? final : null,
    provisional_diagnosis: provisional !== '' ? provisional : null,
    encounter_number: record.encounter?.encounterNumber ?? null,
    encounter_id: record.encounterId,
    recorded_at: record.createdAt ? record.createdAt.toISO() : null,
  }
}

/** Reproduces App\Http\Resources\Portal\LabRequestResource. */
export function labRequestResource(request: LabRequest): Record<string, unknown> {
  const status = String(request.status ?? '')

  const payload: Record<string, unknown> = {
    id: request.id,
    request_number: request.requestNumber,
    status: request.status,
    status_label: status !== '' ? labelize(status) : null,
    priority_level: request.priorityLevel,
    requested_at: request.requestedAt ? request.requestedAt.toISO() : null,
    completed_at: request.completedAt ? request.completedAt.toISO() : null,
    encounter_id: request.encounterId,
  }

  if (request.labRequestItems !== undefined) {
    payload.items = request.labRequestItems.map((item) => ({
      id: item.id,
      test_name: item.testName,
      test_code: item.testCode,
      specimen_type: item.specimenType,
    }))
  }

  if (request.labResults !== undefined) {
    payload.released_results = request.labResults.map((result) => labResultResource(result))
  }

  return payload
}

/** Reproduces App\Http\Resources\Portal\AdmissionResource. */
export function admissionResource(assignment: BedAssignment): Record<string, unknown> {
  return {
    id: assignment.id,
    admitted_at: assignment.admittedAt ? assignment.admittedAt.toISO() : null,
    discharged_at: assignment.dischargedAt ? assignment.dischargedAt.toISO() : null,
    ward_name: assignment.bed?.ward?.name ?? null,
    bed_label: assignment.bed?.bedNumber ?? null,
    encounter_id: assignment.encounterId,
    encounter_number: assignment.encounter?.encounterNumber ?? null,
  }
}

/** Reproduces App\Http\Resources\Portal\DischargeSummaryResource. */
export function dischargeSummaryResource(summary: DischargeSummary): Record<string, unknown> {
  return {
    id: summary.id,
    discharged_at: summary.dischargedAt ? summary.dischargedAt.toISO() : null,
    title: summary.title,
    summary: summary.summary,
    encounter_id: summary.encounterId,
  }
}
