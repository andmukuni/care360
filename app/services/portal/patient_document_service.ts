import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import Patient from '#models/patient'
import PatientDocument from '#models/patient_document'
import PatientAuditService from '#services/portal/patient_audit_service'
import { abortIf, abortUnless } from '#services/portal/portal_errors'

/** Laravel morph class stored on audit rows (matches legacy data). */
const DOCUMENT_MORPH = 'App\\Models\\PatientDocument'

/**
 * Patient-portal document uploads / downloads.
 *
 * Ported from App\Services\Portal\PatientDocumentService.
 *
 * PORT-GAP: Laravel used Storage::disk('local') (root storage/app). No
 * @adonisjs/drive is configured in this app, so files are written directly under
 * `storage/app/patient-documents/{id}` via node fs (same approach as the report
 * export job). `page` param added because Lucid `.paginate()` requires a page.
 */
export default class PatientDocumentService {
  constructor(private readonly auditService: PatientAuditService = new PatientAuditService()) {}

  async listForPatient(patient: Patient, page: number = 1) {
    return PatientDocument.query()
      .where('patientId', patient.id)
      .orderBy('createdAt', 'desc')
      .paginate(page, 15)
  }

  async storeUpload(patient: Patient, file: MultipartFile, title: string): Promise<PatientDocument> {
    const relativeDir = `patient-documents/${patient.id}`
    const fileName = `${randomUUID()}.${file.extname}`
    await file.move(app.makePath('storage/app', relativeDir), { name: fileName, overwrite: true })

    const mimeType = file.type && file.subtype ? `${file.type}/${file.subtype}` : (file.headers['content-type'] ?? null)

    const document = await PatientDocument.create({
      patientId: patient.id,
      title,
      originalFilename: file.clientName,
      filePath: `${relativeDir}/${fileName}`,
      mimeType,
      fileSize: file.size,
      uploadedByType: 'patient',
      approvedForPatient: false,
    })

    await this.auditService.record(patient, 'document.uploaded', DOCUMENT_MORPH, document.id)

    return document
  }

  async documentForPatient(patient: Patient, document: PatientDocument): Promise<PatientDocument> {
    abortIf(Number(document.patientId) !== Number(patient.id), 403)

    return document
  }

  async downloadPath(patient: Patient, document: PatientDocument): Promise<string> {
    document = await this.documentForPatient(patient, document)
    abortUnless(document.approvedForPatient, 403)

    await this.auditService.record(patient, 'document.downloaded', DOCUMENT_MORPH, document.id)

    const absolutePath = app.makePath('storage/app', document.filePath)
    abortUnless(existsSync(absolutePath), 404)

    return absolutePath
  }
}
