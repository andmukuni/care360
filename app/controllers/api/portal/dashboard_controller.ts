import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Patient from '#models/patient'
import Appointment from '#models/appointment'
import HealthTip from '#models/health_tip'
import Notification from '#models/notification'
import User from '#models/user'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientVisitStatusService from '#services/portal/patient_visit_status_service'
import PatientBillingService from '#services/portal/patient_billing_service'
import PatientAppointmentService from '#services/portal/patient_appointment_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import PortalDoctorsCatalog from '#services/portal/portal_doctors_catalog'
import { patientResource } from './auth_controller.js'
import { labResultResource, subjectPatient } from './lab_controller.js'
import { encounterResource, encounterSummaryResource } from './visit_controller.js'
import { prescriptionResource } from './prescription_controller.js'

const PATIENT_MORPH = 'App\\Models\\Patient'
const HEALTH_TIP_ROTATION_SECONDS = 10

const FALLBACK_TIP = {
  category: 'Wellness',
  title: 'Take care of your health',
  message:
    'Small daily habits — water, movement, rest and regular check-ups — make a lasting difference.',
}

/**
 * Aggregated home payload. Ported from
 * App\Http\Controllers\Api\Portal\DashboardController.
 *
 * PORT-GAP: the Laravel controller localized health tips (LocalizedHealthTip) and
 * doctors (PortalStaffLocalizer) by request locale. No i18n layer is ported (same
 * as the web dashboard + health-tips controllers), so English/identity copy is
 * returned regardless of ctx.portalLocale.
 */
export default class DashboardController {
  private readonly medicalSummary = new PatientMedicalSummaryService()
  private readonly visitStatusService = new PatientVisitStatusService()
  private readonly billing = new PatientBillingService()
  private readonly appointments = new PatientAppointmentService()
  private readonly dependentResolver = new PatientDependentResolver()
  private readonly doctorsCatalog = new PortalDoctorsCatalog()

  async index(ctx: HttpContext) {
    const guardian = ctx.auth.use('patient_api').user as Patient
    const patient = await subjectPatient(ctx, this.dependentResolver)

    const visitPayload = await this.visitStatusService.statusPayload(patient)
    const next = await this.appointments.nextAppointment(patient)

    const recentEncounters = await this.medicalSummary.recentEncounters(patient, 3)
    const recentLabResults = await this.medicalSummary.recentReleasedLabResults(patient, 3)
    const recentPrescriptions = await this.medicalSummary.recentPrescriptions(patient, 3)

    return ctx.response.ok({
      patient: await patientResource(patient),
      guardian: await patientResource(guardian),
      viewing_dependent: Number(patient.id) !== Number(guardian.id),
      unread_notifications: await this.unreadNotifications(guardian),
      visit_status: formatVisitStatus(visitPayload),
      next_appointment: next ? appointmentResource(next) : null,
      recent_encounters: recentEncounters.map((e) => encounterSummaryResource(e)),
      recent_lab_results: recentLabResults.map((r) => labResultResource(r)),
      recent_prescriptions: recentPrescriptions.map((p) => prescriptionResource(p)),
      outstanding_balance: await this.billing.outstandingBalance(patient),
      billing_card: await this.billing.cardSummary(patient),
      health_tips: await healthTips(),
      health_tip_rotation_seconds: HEALTH_TIP_ROTATION_SECONDS,
      health_tip: await resolveHealthTip(),
      interested_doctors: await this.doctorsCatalog.allActive(),
    })
  }

  async visitStatus(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const visitPayload = await this.visitStatusService.statusPayload(patient)

    return ctx.response.ok({
      visit_status: formatVisitStatus(visitPayload),
    })
  }

  private async unreadNotifications(guardian: Patient): Promise<number> {
    const result = await Notification.query()
      .where('notifiableType', PATIENT_MORPH)
      .where('notifiableId', guardian.id)
      .whereNull('readAt')
      .count('* as total')

    return Number(result[0].$extras.total)
  }
}

function formatVisitStatus(payload: Record<string, unknown>): Record<string, unknown> {
  const encounter = payload.encounter

  return {
    has_active_visit: payload.has_active_visit,
    stage: payload.stage,
    status: payload.status,
    stage_label: payload.stage_label,
    status_label: payload.status_label,
    queue_position: payload.queue_position,
    guidance: payload.guidance,
    poll_interval_seconds: payload.poll_interval_seconds,
    encounter: encounter ? encounterSummaryResource(encounter as any) : null,
  }
}

/** Reproduces App\Http\Resources\Portal\AppointmentResource. */
export function appointmentResource(appointment: Appointment): Record<string, unknown> {
  const status = String(appointment.status ?? '')
  const provider = appointment.preferredProvider !== undefined ? appointment.preferredProvider : null

  const payload: Record<string, unknown> = {
    id: appointment.id,
    appointment_type: appointment.appointmentType,
    appointment_purpose: appointment.appointmentPurpose,
    reason: appointment.reason,

    status,
    status_label: appointmentStatusLabel(status),
    status_tone: appointmentStatusTone(status),
    is_actionable: ['pending', 'confirmed'].includes(status),

    created_at: appointment.createdAt ? appointment.createdAt.toISO() : null,

    preferred_date: appointment.preferredDate ? appointment.preferredDate.toISODate() : null,
    preferred_time: appointment.preferredTime,
    alternate_date: appointment.alternateDate ? appointment.alternateDate.toISODate() : null,
    alternate_time: appointment.alternateTime,

    confirmed_date: appointment.confirmedDate ? appointment.confirmedDate.toISODate() : null,
    confirmed_time: appointment.confirmedTime,

    preferred_provider_title: provider ? userTitleLabel(provider) : null,
    preferred_provider_role: provider ? userSubtitleLabel(provider) : null,

    staff_notes: appointment.staffNotes,
    cancelled_at: appointment.cancelledAt ? appointment.cancelledAt.toISO() : null,
    cancellation_reason: appointment.cancellationReason,

    patient_id: appointment.patientId,
    is_dependent_booking:
      Number(appointment.requestedByPatientId) !== Number(appointment.patientId),
  }

  if (appointment.confirmedByUser !== undefined) {
    payload.confirmed_by_name = appointment.confirmedByUser?.name ?? null
  }
  if (appointment.preferredProvider !== undefined) {
    payload.preferred_provider_name = provider ? userDisplayName(provider) : null
    payload.preferred_provider_photo_url = provider ? userPhotoUrl(provider) : null
  }
  if (appointment.patient !== undefined) {
    payload.patient_name = appointment.patient?.fullName ?? null
    payload.patient_number = appointment.patient?.patientId ?? null
  }
  if (appointment.requestedByPatient !== undefined) {
    payload.requested_by_name = appointment.requestedByPatient?.fullName ?? null
  }
  const encounters = appointment.encounters
  if (encounters !== undefined && encounters.length > 0) {
    payload.encounter = encounterResource(encounters[0])
  }

  return payload
}

// ── App\Support\Appointments\AppointmentPresenter ──────────────────────────
function appointmentStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Awaiting confirmation'
    case 'confirmed':
      return 'Confirmed'
    case 'completed':
      return 'Completed'
    case 'declined':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function appointmentStatusTone(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success'
    case 'pending':
      return 'warning'
    case 'declined':
      return 'danger'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

// ── App\Models\User portal helpers (patient-facing) ────────────────────────
function userDisplayName(user: User): string {
  const title = (user.title ?? '').trim()
  return title !== '' ? `${title} ${user.name}` : user.name
}

function userTitleLabel(user: User): string | null {
  const title = (user.title ?? '').trim()
  return title !== '' ? title : null
}

function userSubtitleLabel(user: User): string | null {
  const specialty = (user.specialty ?? '').trim()
  if (specialty !== '') {
    return specialty
  }
  const title = userTitleLabel(user)
  if (title === null) {
    return null
  }
  if (userDisplayName(user).toLowerCase().startsWith(title.toLowerCase())) {
    return null
  }
  return title
}

function userPhotoUrl(user: User): string | null {
  return user.profilePhotoPath ? `/storage/${user.profilePhotoPath}` : null
}

// ── App\Support\Portal\HealthTipOfTheDay (localization skipped, see PORT-GAP) ─
async function healthTips(): Promise<Array<{ category: string; title: string; message: string }>> {
  const tips = await HealthTip.query()
    .where('isActive', true)
    .orderBy('sortOrder', 'asc')
    .orderBy('id', 'asc')

  if (tips.length === 0) {
    return [FALLBACK_TIP]
  }

  return tips.map((tip) => ({ category: tip.category, title: tip.title, message: tip.message }))
}

async function resolveHealthTip(): Promise<{ category: string; title: string; message: string }> {
  const tips = await healthTips()
  const index = Math.floor(DateTime.now().toSeconds() / HEALTH_TIP_ROTATION_SECONDS) % tips.length

  return tips[index]
}
