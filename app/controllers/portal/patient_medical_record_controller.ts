import type { HttpContext } from '@adonisjs/core/http'
import LabRequest from '#models/lab_request'
import LabResult from '#models/lab_result'
import PharmacyPrescription from '#models/pharmacy_prescription'
import PortalController from '#controllers/portal/portal_controller'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'

/**
 * Patient medical records. Ported from Portal\PatientMedicalRecordController.
 */
export default class PatientMedicalRecordController extends PortalController {
  private medicalSummary = new PatientMedicalSummaryService()

  async medicalHistory(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const diagnoses = await this.medicalSummary.paginatedDiagnoses(patient, 20, ctx.request.input('page', 1))

    return ctx.inertia.render('portal/medical_history', { patient, diagnoses })
  }

  async lab(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const tab = ctx.request.input('tab') === 'results' ? 'results' : 'requests'
    const requests = await this.medicalSummary.paginatedLabRequests(patient, 20, ctx.request.input('page', 1))
    const results = await this.medicalSummary.paginatedLabResults(patient, 20, ctx.request.input('page', 1))

    return ctx.inertia.render('portal/lab', { patient, requests, results, tab })
  }

  async labRequests(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const requests = await this.medicalSummary.paginatedLabRequests(patient, 20, ctx.request.input('page', 1))

    return ctx.inertia.render('portal/lab_requests/index', { patient, requests })
  }

  async labRequestShow(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const labRequest = await LabRequest.findOrFail(ctx.params.labRequest)
    const request = await this.medicalSummary.labRequestForPatient(patient, labRequest)

    return ctx.inertia.render('portal/lab_requests/show', { patient, request })
  }

  async labResults(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const results = await this.medicalSummary.paginatedLabResults(patient, 20, ctx.request.input('page', 1))

    return ctx.inertia.render('portal/lab_results/index', { patient, results })
  }

  async prescriptions(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const prescriptions = await this.medicalSummary.paginatedPrescriptions(patient, 15, ctx.request.input('page', 1))

    return ctx.inertia.render('portal/prescriptions/index', { patient, prescriptions })
  }

  async prescriptionShow(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const prescription = await PharmacyPrescription.findOrFail(ctx.params.prescription)
    const scoped = await this.medicalSummary.prescriptionForPatient(patient, prescription)

    return ctx.inertia.render('portal/prescriptions/show', { patient, prescription: scoped })
  }

  async admissions(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const admissions = await this.medicalSummary.paginatedAdmissions(patient, 15, ctx.request.input('page', 1))
    const dischargeSummaries = await this.medicalSummary.dischargeSummariesForPatient(patient)

    return ctx.inertia.render('portal/admissions/index', { patient, admissions, dischargeSummaries })
  }

  /**
   * Lab report download. PORT-GAP: Laravel rendered a Blade report view; here we
   * return a minimal HTML document with the released result values.
   */
  async downloadLabReport(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const labResult = await LabResult.findOrFail(ctx.params.labResult)
    const result = await this.medicalSummary.labResultForPatient(patient, labResult)

    const html =
      `<!doctype html><html><head><meta charset="utf-8"><title>Lab Result ${result.id}</title></head>` +
      `<body><h1>Lab Result</h1><p>Patient: ${patient.fullName}</p>` +
      `<pre>${JSON.stringify(result.serialize(), null, 2)}</pre></body></html>`

    ctx.response.header('Content-Type', 'text/html')
    ctx.response.header('Content-Disposition', `attachment; filename="lab-result-${result.id}.html"`)
    return ctx.response.send(html)
  }
}
