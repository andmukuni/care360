import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import HealthTip from '#models/health_tip'
import PortalController from '#controllers/portal/portal_controller'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientVisitStatusService from '#services/portal/patient_visit_status_service'
import PatientBillingService from '#services/portal/patient_billing_service'
import PatientAppointmentService from '#services/portal/patient_appointment_service'
import PortalDoctorsCatalog from '#services/portal/portal_doctors_catalog'

const HEALTH_TIP_ROTATION_SECONDS = 10

/**
 * Patient portal dashboard. Ported from Portal\PatientDashboardController.
 */
export default class PatientDashboardController extends PortalController {
  private medicalSummary = new PatientMedicalSummaryService()
  private visitStatusService = new PatientVisitStatusService()
  private billing = new PatientBillingService()
  private appointments = new PatientAppointmentService()
  private doctors = new PortalDoctorsCatalog()

  private async healthTips() {
    const tips = await HealthTip.query()
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
    if (tips.length === 0) {
      return [
        {
          category: 'Wellness',
          title: 'Take care of your health',
          message:
            'Small daily habits — water, movement, rest and regular check-ups — make a lasting difference.',
        },
      ]
    }
    return tips.map((t) => ({ category: t.category, title: t.title, message: t.message }))
  }

  private async unreadNotificationCount(patientId: number): Promise<number> {
    const row = await db
      .from('notifications')
      .where('notifiable_type', 'App\\Models\\Patient')
      .where('notifiable_id', patientId)
      .whereNull('read_at')
      .count('* as total')
      .first()
    return Number(row?.total ?? 0)
  }

  async home(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const patient = await this.subjectPatient(ctx)

    return ctx.inertia.render('portal/home', {
      patient,
      guardian,
      viewingDependent: patient.id !== guardian.id,
      recentEncounters: await this.medicalSummary.recentEncounters(patient, 3),
      unreadNotifications: await this.unreadNotificationCount(guardian.id),
      visitPayload: await this.visitStatusService.statusPayload(patient),
      nextAppointment: await this.appointments.nextAppointment(patient),
      outstandingBalance: await this.billing.outstandingBalance(patient),
      recentLabResults: await this.medicalSummary.recentReleasedLabResults(patient, 3),
      recentPrescriptions: await this.medicalSummary.recentPrescriptions(patient, 3),
      healthTips: await this.healthTips(),
      healthTipRotationSeconds: HEALTH_TIP_ROTATION_SECONDS,
      interestedDoctors: await this.doctors.allActive(),
    })
  }

  async visitStatus(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)

    return ctx.inertia.render('portal/visit_status', {
      patient,
      visitPayload: await this.visitStatusService.statusPayload(patient),
    })
  }

  async visitStatusPoll(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)

    return ctx.response.json({
      visit_status: await this.visitStatusService.publicPayload(patient),
    })
  }
}
