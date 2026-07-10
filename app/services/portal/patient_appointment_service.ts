import { DateTime } from 'luxon'
import Appointment from '#models/appointment'
import CalendarEvent from '#models/calendar_event'
import Patient from '#models/patient'
import PatientAuditService from '#services/portal/patient_audit_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import { abortUnless } from '#services/portal/portal_errors'

/** Laravel morph class stored on audit rows (matches legacy data). */
const APPOINTMENT_MORPH = 'App\\Models\\Appointment'

export interface CreateAppointmentData {
  appointment_type: string
  appointment_purpose?: string | null
  preferred_provider_id?: number | null
  preferred_date: string
  preferred_time?: string | null
  alternate_date?: string | null
  alternate_time?: string | null
  reason?: string | null
}

export interface RescheduleAppointmentData {
  preferred_date: string
  preferred_time?: string | null
  alternate_date?: string | null
  alternate_time?: string | null
  reason?: string | null
}

/**
 * Patient-portal appointment requests (self and authorized dependents).
 *
 * Ported from App\Services\Portal\PatientAppointmentService.
 *
 * PORT-GAP: Laravel injected App\Services\Appointment\StaffAppointmentService and
 * called removeCalendarEvent(). That service has no AdonisJS equivalent, so the
 * (trivial) calendar-event deletion is inlined here. `page` params were added
 * because Lucid `.paginate()` needs an explicit page.
 */
export default class PatientAppointmentService {
  constructor(
    private readonly auditService: PatientAuditService = new PatientAuditService(),
    private readonly dependentResolver: PatientDependentResolver = new PatientDependentResolver()
  ) {}

  async paginatedForPatient(subject: Patient, perPage: number = 15, page: number = 1) {
    return Appointment.query()
      .where('patientId', subject.id)
      .preload('preferredProvider')
      .orderBy('preferredDate', 'desc')
      .paginate(page, perPage)
  }

  async pending(subject: Patient): Promise<Appointment[]> {
    return Appointment.query()
      .where('patientId', subject.id)
      .where('status', 'pending')
      .orderBy('preferredDate', 'asc')
  }

  async upcoming(subject: Patient): Promise<Appointment[]> {
    const today = DateTime.now().toISODate()!

    return Appointment.query()
      .where('patientId', subject.id)
      .where('status', 'confirmed')
      .where((query) => {
        query.where('confirmedDate', '>=', today).orWhere((sub) => {
          sub.whereNull('confirmedDate').where('preferredDate', '>=', today)
        })
      })
      .orderBy('confirmedDate', 'asc')
      .orderBy('preferredDate', 'asc')
  }

  async nextAppointment(subject: Patient): Promise<Appointment | null> {
    const upcoming = await this.upcoming(subject)

    return upcoming[0] ?? null
  }

  async createRequest(guardian: Patient, subject: Patient, data: CreateAppointmentData): Promise<Appointment> {
    abortUnless(await this.dependentResolver.canBookForPatient(guardian, subject), 403)

    const appointment = await Appointment.create({
      patientId: subject.id,
      requestedByPatientId: guardian.id,
      appointmentType: data.appointment_type,
      appointmentPurpose: data.appointment_purpose ?? null,
      preferredProviderId: data.preferred_provider_id ?? null,
      preferredDate: DateTime.fromISO(data.preferred_date),
      preferredTime: data.preferred_time ?? null,
      alternateDate: data.alternate_date ? DateTime.fromISO(data.alternate_date) : null,
      alternateTime: data.alternate_time ?? null,
      reason: data.reason ?? null,
      status: 'pending',
    })

    await this.auditService.record(guardian, 'appointment.created', APPOINTMENT_MORPH, appointment.id)

    return appointment
  }

  async reschedule(
    guardian: Patient,
    appointment: Appointment,
    data: RescheduleAppointmentData
  ): Promise<Appointment> {
    abortUnless(await this.canManage(guardian, appointment), 403)
    abortUnless(['pending', 'confirmed'].includes(appointment.status), 422)

    appointment.merge({
      preferredDate: DateTime.fromISO(data.preferred_date),
      preferredTime: data.preferred_time ?? null,
      alternateDate: data.alternate_date ? DateTime.fromISO(data.alternate_date) : null,
      alternateTime: data.alternate_time ?? null,
      reason: data.reason ?? appointment.reason,
      status: 'pending',
      confirmedDate: null,
      confirmedTime: null,
      confirmedBy: null,
    })
    await appointment.save()

    await this.removeCalendarEvent(appointment)

    await this.auditService.record(guardian, 'appointment.rescheduled', APPOINTMENT_MORPH, appointment.id)

    await appointment.refresh()

    return appointment
  }

  async cancel(guardian: Patient, appointment: Appointment, reason: string | null = null): Promise<Appointment> {
    abortUnless(await this.canManage(guardian, appointment), 403)
    abortUnless(['pending', 'confirmed'].includes(appointment.status), 422)

    appointment.merge({
      status: 'cancelled',
      cancelledAt: DateTime.now(),
      cancellationReason: reason,
    })
    await appointment.save()

    await this.removeCalendarEvent(appointment)

    await this.auditService.record(guardian, 'appointment.cancelled', APPOINTMENT_MORPH, appointment.id)

    await appointment.refresh()

    return appointment
  }

  async appointmentForGuardian(guardian: Patient, appointment: Appointment): Promise<Appointment> {
    await appointment.load('patient')

    abortUnless(
      Number(appointment.patientId) === Number(guardian.id) ||
        (await this.dependentResolver.canViewPatient(guardian, appointment.patient)) ||
        Number(appointment.requestedByPatientId) === Number(guardian.id),
      403
    )

    return appointment
  }

  private async canManage(guardian: Patient, appointment: Appointment): Promise<boolean> {
    await appointment.load('patient')

    return (
      (await this.dependentResolver.canBookForPatient(guardian, appointment.patient)) ||
      Number(appointment.requestedByPatientId) === Number(guardian.id)
    )
  }

  /** Inlined from Laravel StaffAppointmentService::removeCalendarEvent(). */
  private async removeCalendarEvent(appointment: Appointment): Promise<void> {
    await CalendarEvent.query().where('appointmentId', appointment.id).delete()
  }
}
