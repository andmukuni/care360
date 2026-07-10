import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PlatformComplaint from '#models/platform_complaint'
import Patient from '#models/patient'
import PatientAuditService from '#services/portal/patient_audit_service'

const storeValidator = vine.compile(
  vine.object({
    title: vine.string().maxLength(160),
    description: vine.string().maxLength(5000),
    severity: vine.enum(['low', 'medium', 'high']),
  })
)

/**
 * Patient feedback / complaints (mobile). Ported from Api\Portal\FeedbackController.
 */
export default class FeedbackController {
  private auditService = new PatientAuditService()

  async store(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const { title, description, severity } = await ctx.request.validateUsing(storeValidator)

    await PlatformComplaint.create({
      patientId: patient.id,
      title,
      description,
      severity,
      status: 'open',
    })

    await this.auditService.record(patient, 'feedback.submitted')

    return ctx.response.created({ message: 'Thank you for your feedback.' })
  }
}
