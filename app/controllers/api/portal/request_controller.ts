import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PatientRequest from '#models/patient_request'
import Patient from '#models/patient'
import PatientRequestService from '#services/portal/patient_request_service'
import { pageParam, paginated } from './lab_controller.js'

const storeValidator = vine.compile(
  vine.object({
    request_type: vine.enum(['referral_letter', 'medical_certificate', 'sick_note']),
    details: vine.string().maxLength(5000).nullable().optional(),
  })
)

function requestResource(request: PatientRequest): Record<string, unknown> {
  return {
    id: request.id,
    request_type: request.requestType,
    details: request.details,
    status: request.status,
    staff_response: request.staffResponse,
    created_at: request.createdAt ? request.createdAt.toISO() : null,
  }
}

/**
 * Patient service requests (mobile). Ported from Api\Portal\RequestController.
 */
export default class RequestController {
  private requestService = new PatientRequestService()

  async index(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const paginator = await this.requestService.listForPatient(patient, pageParam(ctx))

    return ctx.response.ok(await paginated(ctx, paginator, (r) => requestResource(r as PatientRequest)))
  }

  async store(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const { request_type, details } = await ctx.request.validateUsing(storeValidator)

    const request = await this.requestService.submit(patient, request_type, details ?? null)

    return ctx.response.created({ message: 'Your request has been submitted.', request: requestResource(request) })
  }
}
