import type { HttpContext } from '@adonisjs/core/http'
import EmergencyService from '#models/emergency_service'
import Patient from '#models/patient'
import EmergencyContactService from '#services/portal/emergency_contact_service'
import PatientAuditService from '#services/portal/patient_audit_service'
import { abortUnless } from '#services/portal/portal_errors'

/**
 * Patient portal emergency services directory. Ported from
 * App\Http\Controllers\Portal\PatientEmergencyController.
 *
 * PORT-GAP: the Laravel EmergencyService model exposed categoryLabel() and
 * dialNumber() helpers plus an is_24_7 accessor. The AdonisJS model does not, so
 * the category label map and the dial-number normalisation are inlined here and
 * the raw `is247` column is exposed to the page.
 */
const CATEGORY_LABELS: Record<string, string> = {
  ambulance: 'Ambulance',
  emergency_line: 'Emergency line',
  trauma: 'Trauma & casualty',
  maternity: 'Maternity emergency',
  poison: 'Poison control',
  security: 'Hospital security',
  other: 'Other',
}

export default class PatientEmergencyController {
  private readonly emergencyContacts = new EmergencyContactService()
  private readonly auditService = new PatientAuditService()

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user!
  }

  async index(ctx: HttpContext) {
    const { inertia } = ctx
    const services = await this.emergencyContacts.activeServices()

    return inertia.render('portal/emergency/index', {
      services: services.map((service) => ({
        ...service.serialize(),
        category_label: this.categoryLabel(service.category),
      })),
    })
  }

  async call(ctx: HttpContext) {
    const { params, inertia, request } = ctx
    const service = await EmergencyService.findOrFail(params.emergencyService)

    abortUnless(service.isActive, 404)

    const patient = this.guardian(ctx)

    await this.emergencyContacts.logContact(patient, service, 'portal_web')
    await this.auditService.record(
      patient,
      'emergency.call',
      'emergency_service',
      service.id,
      { service: service.name, phone: service.phoneNumber },
      request
    )

    const dial = this.dialNumber(service.phoneNumber)

    return inertia.location(`tel:${dial}`)
  }

  private categoryLabel(category: string): string {
    if (CATEGORY_LABELS[category]) {
      return CATEGORY_LABELS[category]
    }
    const s = category.replace(/_/g, ' ')
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  private dialNumber(phone: string): string {
    return (phone ?? '').replace(/\s+/g, '')
  }
}
