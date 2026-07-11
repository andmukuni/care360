import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import LabResult from '#models/lab_result'
import Patient from '#models/patient'
import PatientDependent from '#models/patient_dependent'
import PatientDocument from '#models/patient_document'
import PatientRequest from '#models/patient_request'
import InvoiceService from '#services/billing/invoice_service'
import WellnessFundService from '#services/membership/wellness_fund_service'

/**
 * Staff-side administration of patient-portal artefacts: portal requests,
 * self-registration approvals, ad-hoc invoicing, document approval, lab-result
 * release, and dependent authorisations.
 * Ported from App\Http\Controllers\PatientPortalAdminController.
 *
 * Faithful notes:
 *   - `declinePortalRegistration` deletes the patient's Sanctum tokens directly
 *     against `personal_access_tokens` (polymorphic tokenable), mirroring
 *     `$patient->tokens()->delete()`.
 *   - List endpoints return the full ordered set (no server pagination) for the
 *     client-side DataTable.
 */
export default class PatientPortalAdminController {
  private readonly invoiceService = new InvoiceService()
  private readonly wellnessFund = new WellnessFundService()

  async patientRequests({ inertia }: HttpContext) {
    const requests = await PatientRequest.query()
      .where('status', 'pending')
      .preload('patient', (q) => q.select('id', 'patientId', 'fullName', 'phoneNumber'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    return inertia.render('patient-requests/index', {
      requests: requests.map((r) => ({
        id: r.id,
        requestType: r.requestType,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt ? r.createdAt.toISO() : null,
        patient: r.patient
          ? {
              id: r.patient.id,
              patientNumber: r.patient.patientId,
              fullName: r.patient.fullName,
              phoneNumber: r.patient.phoneNumber,
            }
          : null,
      })),
    })
  }

  async portalRegistrations({ inertia }: HttpContext) {
    const registrations = await Patient.query()
      .whereNotNull('password')
      .where('portalEnabled', false)
      .where((q) => {
        q.whereNull('isDeceased').orWhere('isDeceased', false)
      })
      .orderBy('updatedAt', 'desc')

    return inertia.render('portal-registrations/index', {
      pendingCount: registrations.length,
      registrations: registrations.map((p) => ({
        id: p.id,
        patientNumber: p.patientId,
        fullName: p.fullName,
        email: p.email,
        phoneNumber: p.phoneNumber,
        gender: p.gender,
        status: p.status,
        updatedAt: p.updatedAt ? p.updatedAt.toISO() : null,
        updatedAtFormatted: p.updatedAt ? p.updatedAt.toFormat('dd LLL yyyy, HH:mm') : null,
        updatedAtRelative: p.updatedAt?.toRelative() ?? null,
      })),
    })
  }

  async approvePortalRegistration({ params, response, session }: HttpContext) {
    const patient = await this.findPatient(params.ref)

    if (!patient.password || patient.password.trim() === '') {
      session.flash('error', 'This patient has not set a portal password.')
      return response.redirect().back()
    }

    patient.merge({
      portalEnabled: true,
      status: patient.status || 'active',
      emailVerifiedAt: patient.emailVerifiedAt ?? DateTime.now(),
    })
    await patient.save()

    session.flash('success', `${patient.fullName} has been approved and can now sign in.`)
    return response.redirect().back()
  }

  async declinePortalRegistration({ params, response, session }: HttpContext) {
    const patient = await this.findPatient(params.ref)

    await db
      .from('personal_access_tokens')
      .where('tokenable_type', 'App\\Models\\Patient')
      .where('tokenable_id', patient.id)
      .delete()

    patient.merge({ password: null, portalEnabled: false })
    await patient.save()

    session.flash('success', `${patient.fullName}’s portal sign-up was declined.`)
    return response.redirect().back()
  }

  async storeInvoice({ params, request, response, session, auth }: HttpContext) {
    const patient = await this.findPatient(params.ref)

    const validator = vine.compile(
      vine.object({
        description: vine.string().trim().maxLength(255),
        quantity: vine.number().min(1),
        unit_price: vine.number().min(0),
        notes: vine.string().trim().maxLength(2000).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)
    const user = auth.use('web').user ?? null

    let invoice = await this.invoiceService.createDraft(
      patient,
      null,
      [{ description: data.description, quantity: data.quantity, unitPrice: data.unit_price }],
      data.notes ?? null,
      user
    )

    invoice = await this.wellnessFund.applyDiscountToInvoice(invoice)
    const discount = await this.wellnessFund.activeDiscountPercent(patient)
    await invoice.refresh()
    invoice = await this.invoiceService.issue(invoice)
    await invoice.refresh()
    await this.wellnessFund.reconcileHospitalInvoice(invoice, user)

    let message = `Invoice ${invoice.invoiceNumber} issued.`
    if (discount > 0) {
      message += ' Membership discount applied.'
    }

    session.flash('success', message)
    return response.redirect().back()
  }

  async approveDocument({ params, response, session, auth }: HttpContext) {
    const patient = await this.findPatient(params.ref)
    const document = await PatientDocument.findOrFail(params.document)

    if (Number(document.patientId) !== Number(patient.id)) {
      throw new Exception('Document not found for this patient.', { status: 404 })
    }

    document.merge({
      approvedForPatient: true,
      approvedBy: auth.user?.id ?? null,
      approvedAt: DateTime.now(),
    })
    await document.save()

    session.flash('success', 'Document approved for patient download.')
    return response.redirect().back()
  }

  async releaseLabResult({ params, response, session, auth }: HttpContext) {
    const labResult = await LabResult.findOrFail(params.labResult)

    if (labResult.releasedToPatientAt) {
      labResult.merge({ releasedToPatientAt: null, releasedBy: null })
      await labResult.save()

      session.flash('success', 'Lab result hidden from the patient portal.')
      return response.redirect().back()
    }

    labResult.merge({ releasedToPatientAt: DateTime.now(), releasedBy: auth.user?.id ?? null })
    await labResult.save()

    session.flash('success', 'Lab result released to patient portal.')
    return response.redirect().back()
  }

  async storeDependent({ params, request, response, session, auth }: HttpContext) {
    const guardian = await this.findPatient(params.ref)

    const validator = vine.compile(
      vine.object({
        dependent_patient_id: vine.number(),
        relationship: vine.string().trim().maxLength(50),
        can_view_records: vine.boolean().optional(),
        can_book_appointments: vine.boolean().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const dependent = await Patient.find(data.dependent_patient_id)
    if (!dependent) {
      session.flash('error', 'The selected dependent patient could not be found.')
      return response.redirect().back()
    }

    await PatientDependent.updateOrCreate(
      { guardianPatientId: guardian.id, dependentPatientId: data.dependent_patient_id },
      {
        relationship: data.relationship,
        canViewRecords: data.can_view_records ?? false,
        canBookAppointments: data.can_book_appointments ?? false,
        authorizedAt: DateTime.now(),
        authorizedBy: auth.user?.id ?? null,
      }
    )

    session.flash('success', 'Dependent authorization saved.')
    return response.redirect().back()
  }

  private async findPatient(ref: string): Promise<Patient> {
    const numeric = /^\d+$/.test(String(ref)) ? Number(ref) : 0

    const patient = await Patient.query()
      .where('patientId', ref)
      .orWhere('barcode', ref)
      .orWhere('id', numeric)
      .first()

    if (!patient) {
      throw new Exception('Patient not found.', { status: 404 })
    }

    return patient
  }
}
