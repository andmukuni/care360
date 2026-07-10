import Patient from '#models/patient'
import PatientRequest from '#models/patient_request'
import PatientAuditService from '#services/portal/patient_audit_service'

/** Laravel morph class stored on audit rows (matches legacy data). */
const REQUEST_MORPH = 'App\\Models\\PatientRequest'

/**
 * Patient-portal service requests (records copies, refills, etc.).
 *
 * Ported from App\Services\Portal\PatientRequestService.
 *
 * PORT-GAP: `page` param added because Lucid `.paginate()` requires an explicit page.
 */
export default class PatientRequestService {
  constructor(private readonly auditService: PatientAuditService = new PatientAuditService()) {}

  async listForPatient(patient: Patient, page: number = 1) {
    return PatientRequest.query()
      .where('patientId', patient.id)
      .orderBy('createdAt', 'desc')
      .paginate(page, 15)
  }

  async submit(patient: Patient, type: string, details: string | null): Promise<PatientRequest> {
    const request = await PatientRequest.create({
      patientId: patient.id,
      requestType: type,
      details,
      status: 'pending',
    })

    await this.auditService.record(patient, 'request.submitted', REQUEST_MORPH, request.id, { type })

    return request
  }
}
