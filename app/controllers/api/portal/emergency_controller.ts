import type { HttpContext } from '@adonisjs/core/http'
import EmergencyService from '#models/emergency_service'
import Patient from '#models/patient'
import EmergencyContactService from '#services/portal/emergency_contact_service'
import PatientAuditService from '#services/portal/patient_audit_service'

function serviceResource(service: EmergencyService): Record<string, unknown> {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    category: service.category,
    phone_number: service.phoneNumber,
    secondary_phone: service.secondaryPhone,
    description: service.description,
    instructions: service.instructions,
    is_24_7: service.is247,
  }
}

/**
 * Emergency services directory (mobile). Ported from Api\Portal\EmergencyController.
 */
export default class EmergencyController {
  private emergencyContacts = new EmergencyContactService()
  private auditService = new PatientAuditService()

  async index(ctx: HttpContext) {
    const services = await this.emergencyContacts.activeServices()
    return ctx.response.ok({ data: services.map((s) => serviceResource(s)) })
  }

  async logCall(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const service = await EmergencyService.findOrFail(ctx.params.emergencyService)

    if (!service.isActive) {
      return ctx.response.notFound({ message: 'Not found.' })
    }

    await this.emergencyContacts.logContact(patient, service, 'portal_mobile')
    await this.auditService.record(patient, 'emergency.call', 'emergency_service', service.id, {
      service: service.name,
      phone: service.phoneNumber,
    })

    return ctx.response.ok({ message: 'Contact logged.', dial: service.phoneNumber })
  }
}
