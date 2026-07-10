import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Patient from '#models/patient'
import PlatformComplaint from '#models/platform_complaint'
import PatientAuditService from '#services/portal/patient_audit_service'

/**
 * Patient portal feedback (platform complaints). Ported from
 * App\Http\Controllers\Portal\PatientFeedbackController.
 */
const storeValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(160),
    description: vine.string().trim().maxLength(5000),
    severity: vine.enum(['low', 'medium', 'high']),
  })
)

export default class PatientFeedbackController {
  private readonly auditService = new PatientAuditService()

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user!
  }

  async index(ctx: HttpContext) {
    const { inertia } = ctx
    const patient = this.guardian(ctx)

    return inertia.render('portal/feedback/index', {
      patient: patient.serialize(),
    })
  }

  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    const patient = this.guardian(ctx)

    const validated = await request.validateUsing(storeValidator)

    await PlatformComplaint.create({
      patientId: patient.id,
      title: validated.title,
      description: validated.description,
      severity: validated.severity,
      status: 'open',
    })

    await this.auditService.record(patient, 'feedback.submitted')

    session.flash('success', 'Thank you for your feedback.')

    return response.redirect('/portal/feedback')
  }
}
