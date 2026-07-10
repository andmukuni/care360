import type { HttpContext } from '@adonisjs/core/http'
import Encounter from '#models/encounter'
import PortalController from '#controllers/portal/portal_controller'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'

/**
 * Patient visits / encounters. Ported from Portal\PatientVisitController.
 */
export default class PatientVisitController extends PortalController {
  private medicalSummary = new PatientMedicalSummaryService()

  async index(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const encounters = await this.medicalSummary.paginatedEncounters(patient, 15, ctx.request.input('page', 1))

    return ctx.inertia.render('portal/visits/index', { patient, encounters })
  }

  async show(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const encounter = await Encounter.findOrFail(ctx.params.encounter)
    const scoped = await this.medicalSummary.encounterForPatient(patient, encounter)
    const diagnoses = await this.medicalSummary.diagnosisSummaryForEncounter(scoped)

    return ctx.inertia.render('portal/visits/show', { patient, encounter: scoped, diagnoses })
  }
}
