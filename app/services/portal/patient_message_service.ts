import Patient from '#models/patient'
import PatientMessage from '#models/patient_message'
import PatientAuditService from '#services/portal/patient_audit_service'

/** Laravel morph class stored on audit rows (matches legacy data). */
const MESSAGE_MORPH = 'App\\Models\\PatientMessage'

/**
 * Patient-portal secure messaging.
 *
 * Ported from App\Services\Portal\PatientMessageService.
 *
 * PORT-GAP: `page` param added because Lucid `.paginate()` requires an explicit page.
 */
export default class PatientMessageService {
  constructor(private readonly auditService: PatientAuditService = new PatientAuditService()) {}

  async listForPatient(patient: Patient, page: number = 1) {
    return PatientMessage.query()
      .where('patientId', patient.id)
      .orderBy('createdAt', 'desc')
      .paginate(page, 20)
  }

  async send(patient: Patient, subject: string, body: string): Promise<PatientMessage> {
    const message = await PatientMessage.create({
      patientId: patient.id,
      subject,
      body,
      direction: 'out',
    })

    await this.auditService.record(patient, 'message.sent', MESSAGE_MORPH, message.id)

    return message
  }
}
