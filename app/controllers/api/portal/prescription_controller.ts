import type { HttpContext } from '@adonisjs/core/http'
import PharmacyPrescription from '#models/pharmacy_prescription'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import { labelize, pageParam, paginated, subjectPatient } from './lab_controller.js'

/**
 * Prescriptions. Ported from App\Http\Controllers\Api\Portal\PrescriptionController.
 */
export default class PrescriptionController {
  private readonly medicalSummary = new PatientMedicalSummaryService()
  private readonly dependentResolver = new PatientDependentResolver()

  async index(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const page = pageParam(ctx)

    const paginator = await this.medicalSummary.paginatedPrescriptions(patient, 15, page)

    return ctx.response.ok(
      await paginated(ctx, paginator, (p) => prescriptionResource(p as PharmacyPrescription))
    )
  }

  async show(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const prescription = await PharmacyPrescription.findOrFail(ctx.params.prescription)

    const result = await this.medicalSummary.prescriptionForPatient(patient, prescription)

    return ctx.response.ok({ data: prescriptionResource(result) })
  }
}

/** Reproduces App\Http\Resources\Portal\PrescriptionResource. */
export function prescriptionResource(prescription: PharmacyPrescription): Record<string, unknown> {
  const status = String(prescription.status ?? '')
  const items = prescription.pharmacyPrescriptionItems ?? []

  return {
    id: prescription.id,
    prescription_number: prescription.prescriptionNumber,
    status: status !== '' ? status : null,
    status_label: labelize(status),
    notes: prescription.notes,
    prescribed_at: prescription.prescribedAt ? prescription.prescribedAt.toISO() : null,
    encounter_id: prescription.encounterId,
    items: items.map((item) => prescriptionItemResource(item)),
  }
}

/** Reproduces App\Http\Resources\Portal\PrescriptionItemResource. */
export function prescriptionItemResource(item: PharmacyPrescriptionItem): Record<string, unknown> {
  const frequency = [item.frequency, item.frequencyUnit].filter((p) => Boolean(p)).join(' ').trim()
  const duration = [item.duration, item.durationUnit].filter((p) => Boolean(p)).join(' ').trim()

  return {
    id: item.id,
    drug_name: item.drugName,
    strength: item.strength,
    formulation: item.formulation,
    dose: item.dose,
    route: item.route,
    frequency: frequency !== '' ? frequency : null,
    duration: duration !== '' ? duration : null,
    quantity_prescribed: item.quantityPrescribed,
    instructions: item.instructions,
    start_date: item.startDate ? item.startDate.toISODate() : null,
    end_date: item.endDate ? item.endDate.toISODate() : null,
  }
}
