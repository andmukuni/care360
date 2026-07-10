import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PatientMessage from '#models/patient_message'
import Patient from '#models/patient'
import PatientMessageService from '#services/portal/patient_message_service'
import { pageParam, paginated } from './lab_controller.js'

const storeValidator = vine.compile(
  vine.object({
    subject: vine.string().maxLength(160),
    body: vine.string().maxLength(5000),
  })
)

function messageResource(message: PatientMessage): Record<string, unknown> {
  return {
    id: message.id,
    subject: message.subject,
    body: message.body,
    direction: message.direction,
    read_at: message.readAt ? message.readAt.toISO() : null,
    created_at: message.createdAt ? message.createdAt.toISO() : null,
  }
}

/**
 * Patient support messages (mobile). Ported from Api\Portal\MessageController.
 */
export default class MessageController {
  private messageService = new PatientMessageService()

  async index(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const paginator = await this.messageService.listForPatient(patient, pageParam(ctx))

    return ctx.response.ok(await paginated(ctx, paginator, (m) => messageResource(m as PatientMessage)))
  }

  async store(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const { subject, body } = await ctx.request.validateUsing(storeValidator)

    const message = await this.messageService.send(patient, subject, body)

    return ctx.response.created({ message: 'Message sent to hospital support.', data: messageResource(message) })
  }
}
