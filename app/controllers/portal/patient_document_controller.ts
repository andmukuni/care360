import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Patient from '#models/patient'
import PatientDocument from '#models/patient_document'
import PatientDocumentService from '#services/portal/patient_document_service'

/**
 * Patient portal document uploads / downloads. Ported from
 * App\Http\Controllers\Portal\PatientDocumentController.
 *
 * NOTE: documents are keyed to the authenticated guardian (not the viewing
 * dependent), matching the Laravel controller which used $this->guardian().
 */
const storeValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(160),
    file: vine.file({
      size: '10mb',
      extnames: ['pdf', 'jpg', 'jpeg', 'png'],
    }),
  })
)

export default class PatientDocumentController {
  private readonly documentService = new PatientDocumentService()

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user!
  }

  async index(ctx: HttpContext) {
    const { request, inertia } = ctx
    const patient = this.guardian(ctx)
    const page = Number(request.input('page', 1)) || 1

    const documents = await this.documentService.listForPatient(patient, page)

    return inertia.render('portal/documents/index', {
      patient: patient.serialize(),
      documents: documents.serialize(),
    })
  }

  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    const patient = this.guardian(ctx)

    const { title, file } = await request.validateUsing(storeValidator)

    await this.documentService.storeUpload(patient, file, title)

    session.flash('success', 'Document uploaded. It will be available after hospital approval.')

    return response.redirect('/portal/documents')
  }

  async download(ctx: HttpContext) {
    const { params, response } = ctx
    const patient = this.guardian(ctx)

    const document = await PatientDocument.findOrFail(params.document)
    const path = await this.documentService.downloadPath(patient, document)

    return response.attachment(path, document.originalFilename)
  }
}
