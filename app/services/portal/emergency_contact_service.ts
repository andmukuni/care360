import { DateTime } from 'luxon'
import EmergencyContactLog from '#models/emergency_contact_log'
import EmergencyService from '#models/emergency_service'
import Patient from '#models/patient'

/**
 * Emergency-contact directory and contact logging for the patient portal.
 *
 * Ported from App\Services\Portal\EmergencyContactService.
 */
export default class EmergencyContactService {
  async activeServices(): Promise<EmergencyService[]> {
    // Inlines the Laravel EmergencyService scopeActive() + scopeOrdered().
    return EmergencyService.query().where('isActive', true).orderBy('sortOrder').orderBy('name')
  }

  async logContact(
    patient: Patient,
    service: EmergencyService,
    source: string,
    phoneDialed: string | null = null
  ): Promise<EmergencyContactLog> {
    return EmergencyContactLog.create({
      patientId: patient.id,
      emergencyServiceId: service.id,
      source,
      phoneDialed: phoneDialed ?? service.phoneNumber,
      contactedAt: DateTime.now(),
    })
  }
}
