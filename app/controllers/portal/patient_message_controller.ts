import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Patient from '#models/patient'
import PatientMessageService from '#services/portal/patient_message_service'

/**
 * Patient portal secure messaging. Ported from
 * App\Http\Controllers\Portal\PatientMessageController.
 *
 * NOTE: messages are keyed to the authenticated guardian (not the viewing
 * dependent), matching the Laravel controller which used $this->guardian().
 */
const storeValidator = vine.compile(
  vine.object({
    subject: vine.string().trim().maxLength(160),
    body: vine.string().trim().maxLength(5000),
  })
)

export default class PatientMessageController {
  private readonly messageService = new PatientMessageService()

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user!
  }

  async index(ctx: HttpContext) {
    const { request, inertia } = ctx
    const patient = this.guardian(ctx)
    const page = Number(request.input('page', 1)) || 1

    const messages = await this.messageService.listForPatient(patient, page)

    return inertia.render('portal/messages/index', {
      patient: patient.serialize(),
      messages: messages.serialize(),
    })
  }

  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    const patient = this.guardian(ctx)

    const validated = await request.validateUsing(storeValidator)

    await this.messageService.send(patient, validated.subject, validated.body)

    session.flash('success', 'Message sent to hospital support.')

    return response.redirect('/portal/messages')
  }
}
