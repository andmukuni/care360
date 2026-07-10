import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PatientDocument from '#models/patient_document'
import Patient from '#models/patient'
import PatientDocumentService from '#services/portal/patient_document_service'
import { pageParam, paginated } from './lab_controller.js'

const titleValidator = vine.compile(vine.object({ title: vine.string().maxLength(160) }))

function documentResource(document: PatientDocument): Record<string, unknown> {
  return {
    id: document.id,
    title: document.title,
    original_filename: document.originalFilename,
    mime_type: document.mimeType,
    file_size: document.fileSize,
    approved_for_patient: document.approvedForPatient,
    created_at: document.createdAt ? document.createdAt.toISO() : null,
  }
}

/**
 * Patient documents (mobile). Ported from Api\Portal\DocumentController.
 */
export default class DocumentController {
  private documentService = new PatientDocumentService()

  async index(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const paginator = await this.documentService.listForPatient(patient, pageParam(ctx))

    return ctx.response.ok(await paginated(ctx, paginator, (d) => documentResource(d as PatientDocument)))
  }

  async store(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const { title } = await ctx.request.validateUsing(titleValidator)
    const file = ctx.request.file('file', { size: '10mb', extnames: ['pdf', 'jpg', 'jpeg', 'png'] })

    if (!file || !file.isValid) {
      return ctx.response.unprocessableEntity({ errors: { file: [file?.errors?.[0]?.message ?? 'A valid file is required.'] } })
    }

    const document = await this.documentService.storeUpload(patient, file, title)

    return ctx.response.created({
      message: 'Document uploaded. It will be available after hospital approval.',
      document: documentResource(document),
    })
  }

  async download(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const document = await PatientDocument.findOrFail(ctx.params.document)
    const path = await this.documentService.downloadPath(patient, document)

    return ctx.response.download(path)
  }
}
