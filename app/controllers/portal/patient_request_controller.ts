import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Patient from '#models/patient'
import PatientRequestService from '#services/portal/patient_request_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'

/**
 * Patient portal service requests (referral letters, certificates, sick notes).
 * Ported from App\Http\Controllers\Portal\PatientRequestController.
 */
const storeValidator = vine.compile(
  vine.object({
    request_type: vine.enum(['referral_letter', 'medical_certificate', 'sick_note']),
    details: vine.string().maxLength(5000).optional(),
  })
)

export default class PatientRequestController {
  private readonly requestService = new PatientRequestService()
  private readonly dependentResolver = new PatientDependentResolver()

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user!
  }

  private subjectPatient(ctx: HttpContext): Promise<Patient> {
    return this.dependentResolver.viewingPatient(this.guardian(ctx), ctx.session)
  }

  async index(ctx: HttpContext) {
    const { request, inertia } = ctx
    const patient = await this.subjectPatient(ctx)
    const page = Number(request.input('page', 1)) || 1

    const requests = await this.requestService.listForPatient(patient, page)

    return inertia.render('portal/requests/index', {
      patient: patient.serialize(),
      requests: requests.serialize(),
    })
  }

  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    const patient = await this.subjectPatient(ctx)

    const validated = await request.validateUsing(storeValidator)

    await this.requestService.submit(patient, validated.request_type, validated.details ?? null)

    session.flash('success', 'Your request has been submitted.')

    return response.redirect('/portal/requests')
  }
}
