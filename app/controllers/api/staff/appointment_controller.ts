import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Appointment from '#models/appointment'
import CalendarEvent from '#models/calendar_event'
import Patient from '#models/patient'
import type User from '#models/user'
import { EncounterStage } from '#enums/encounter_stage'
import StartEncounterFromAppointmentAction from '#actions/encounter/start_encounter_from_appointment_action'
import {
  ActiveEncounterExistsException,
  PatientNotEligibleForEncounterException,
} from '#support/encounter/exceptions'

/**
 * Registration desk appointments API. Ported from
 * App\Http\Controllers\Api\Staff\AppointmentController.
 *
 * Registrars review booked appointments, confirm/decline them, and check a
 * confirmed appointment in — starting an encounter and queueing it to a stage.
 *
 * PORT-GAPs (mirroring the web AppointmentsController port):
 *  - App\Services\Appointment\StaffAppointmentService has no Adonis port, so the
 *    confirm/decline mutations + calendar-event sync are performed inline here.
 *  - The patient AppointmentStatusNotification (confirmed/declined) is NOT sent
 *    (no notification pipeline yet).
 *  - ActiveEncounterExistsException does not expose the offending encounter, only
 *    its message, so the encounter number is parsed out of the message text.
 */
const QUEUEABLE_STAGES = ['triage', 'screening', 'lab', 'screening_review', 'pharmacy'] as const
const ALLOWED_PER_PAGE = [25, 50, 100]

export default class AppointmentController {
  /**
   * GET /api/v1/staff/appointments?tab=pending|confirmed|today&q=&page=&per_page=
   */
  async index({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        tab: vine.enum(['pending', 'confirmed', 'today']).optional(),
        q: vine.string().maxLength(100).optional(),
        page: vine.number().min(1).optional(),
        per_page: vine.number().optional(),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })

    const tab = validated.tab ?? 'pending'
    const perPage = ALLOWED_PER_PAGE.includes(validated.per_page ?? 25) ? validated.per_page! : 25
    const page = validated.page ?? 1
    const q = validated.q ? validated.q.trim() : ''
    const today = DateTime.now().toISODate()!

    const query = Appointment.query()
      .preload('patient')
      .preload('preferredProvider')
      .preload('encounters')

    if (tab === 'confirmed') {
      query
        .where('status', 'confirmed')
        .where((w) => {
          w.where('confirmed_date', '>=', today).orWhere((w2) => {
            w2.whereNull('confirmed_date').where('preferred_date', '>=', today)
          })
        })
        .orderBy('confirmed_date')
        .orderBy('preferred_date')
    } else if (tab === 'today') {
      query.where('status', 'confirmed').where('confirmed_date', today).orderBy('confirmed_time')
    } else {
      query.where('status', 'pending').orderBy('preferred_date')
    }

    if (q !== '') {
      const like = `%${q}%`
      query.where((sub) => {
        sub
          .whereILike('appointment_type', like)
          .orWhereILike('reason', like)
          .orWhereHas('patient', (p) => {
            p.whereILike('full_name', like).orWhereILike('patient_id', like)
          })
      })
    }

    const paginator = await query.paginate(page, perPage)
    const items = paginator.all()

    const pendingRow = await db
      .from('appointments')
      .where('status', 'pending')
      .count('* as count')
      .first()
    const pendingCount = Number(pendingRow?.count ?? 0)

    return response.ok({
      data: items.map((a) => {
        const p = a.patient
        return {
          id: a.id,
          appointment_type: a.appointmentType,
          appointment_purpose: a.appointmentPurpose,
          reason: a.reason,
          status: a.status,
          preferred_date: this.fmtDate(a.preferredDate),
          preferred_time: this.fmtTime(a.preferredTime),
          confirmed_date: this.fmtDate(a.confirmedDate),
          confirmed_time: this.fmtTime(a.confirmedTime),
          provider: a.preferredProvider?.name ?? null,
          has_encounter: (a.encounters?.length ?? 0) > 0,
          patient: p
            ? {
                id: p.id,
                patient_number: p.patientId,
                full_name: p.fullName,
                profile_photo_url: this.profilePhotoUrl(p),
                gender: p.gender,
                age: this.age(p.dateOfBirth),
                phone_number: p.phoneNumber,
              }
            : null,
        }
      }),
      meta: this.paginationMeta(paginator, items.length),
      pending_count: pendingCount,
    })
  }

  /** GET /api/v1/staff/appointments/{appointment} — full detail. */
  async show({ params, response }: HttpContext) {
    const appointment = await Appointment.query()
      .where('id', params.appointment)
      .preload('patient')
      .preload('requestedByPatient')
      .preload('confirmedByUser')
      .preload('preferredProvider')
      .preload('encounters', (q) => q.orderBy('id', 'desc'))
      .firstOrFail()

    const a = appointment
    const p = a.patient
    const encounter = a.encounters?.[0] ?? null

    return response.ok({
      appointment: {
        id: a.id,
        appointment_type: a.appointmentType,
        appointment_purpose: a.appointmentPurpose,
        reason: a.reason,
        status: a.status,
        preferred_date: this.fmtDate(a.preferredDate),
        preferred_time: this.fmtTime(a.preferredTime),
        alternate_date: this.fmtDate(a.alternateDate),
        alternate_time: this.fmtTime(a.alternateTime),
        confirmed_date: this.fmtDate(a.confirmedDate),
        confirmed_time: this.fmtTime(a.confirmedTime),
        provider: a.preferredProvider?.name ?? null,
        requested_by: a.requestedByPatient?.fullName ?? null,
        confirmed_by: a.confirmedByUser?.name ?? null,
        staff_notes: a.staffNotes,
        cancellation_reason: a.cancellationReason,
        created_at: this.fmtDate(a.createdAt),
        encounter: encounter
          ? {
              encounter_number: encounter.encounterNumber,
              current_stage: encounter.currentStage,
              current_status: encounter.currentStatus,
            }
          : null,
        patient: p
          ? {
              id: p.id,
              patient_number: p.patientId,
              full_name: p.fullName,
              profile_photo_url: this.profilePhotoUrl(p),
              gender: p.gender,
              age: this.age(p.dateOfBirth),
              nrc_number: p.nrcNumber,
              phone_number: p.phoneNumber,
            }
          : null,
      },
    })
  }

  /** POST /api/v1/staff/appointments/{appointment}/confirm */
  async confirm({ params, request, response, auth }: HttpContext) {
    const user = auth.use('api').user as User
    const appointment = await Appointment.findOrFail(params.appointment)

    const validator = vine.compile(
      vine.object({
        confirmed_date: vine.string().trim().nullable().optional(),
        confirmed_time: vine
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
        staff_notes: vine.string().trim().maxLength(2000).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    appointment.merge({
      status: 'confirmed',
      confirmedDate: data.confirmed_date
        ? DateTime.fromISO(data.confirmed_date)
        : appointment.preferredDate,
      confirmedTime: data.confirmed_time ?? appointment.preferredTime,
      confirmedBy: user.id,
      staffNotes: data.staff_notes ?? null,
    })
    await appointment.save()

    await this.syncCalendarEvent(appointment, user.id)
    // STUB: patient AppointmentStatusNotification('confirmed') not sent (no notification pipeline).

    return response.ok({ message: 'Appointment confirmed.' })
  }

  /** POST /api/v1/staff/appointments/{appointment}/decline */
  async decline({ params, request, response, auth }: HttpContext) {
    const user = auth.use('api').user as User
    const appointment = await Appointment.findOrFail(params.appointment)

    const validator = vine.compile(
      vine.object({
        staff_notes: vine.string().trim().maxLength(2000).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    appointment.merge({
      status: 'declined',
      staffNotes: data.staff_notes ?? null,
      confirmedBy: user.id,
    })
    await appointment.save()

    await CalendarEvent.query().where('appointmentId', appointment.id).delete()
    // STUB: patient AppointmentStatusNotification('declined') not sent (no notification pipeline).

    return response.ok({ message: 'Appointment declined.' })
  }

  /**
   * POST /api/v1/staff/appointments/{appointment}/queue
   * Check in: start an encounter from the appointment and queue it to a stage.
   */
  async checkIn({ params, request, response, auth }: HttpContext) {
    const user = auth.use('api').user as User

    const validator = vine.compile(
      vine.object({
        stage: vine.enum(QUEUEABLE_STAGES).nullable().optional(),
        notes: vine.string().trim().maxLength(2000).nullable().optional(),
      })
    )
    const validated = await request.validateUsing(validator)

    const appointment = await Appointment.query()
      .where('id', params.appointment)
      .preload('patient')
      .firstOrFail()

    if (appointment.status !== 'confirmed') {
      return response.unprocessableEntity({
        message: 'Only confirmed appointments can be checked in.',
      })
    }
    if (!appointment.patient) {
      return response.unprocessableEntity({ message: 'This appointment has no linked patient.' })
    }

    const stage = (validated.stage ?? 'triage') as EncounterStage

    try {
      const encounter = await new StartEncounterFromAppointmentAction().handle(
        appointment,
        stage,
        user.id,
        validated.notes ?? null
      )

      return response.ok({
        message: `Encounter ${encounter.encounterNumber} started and queued to ${stage.replace(
          /_/g,
          ' '
        )}.`,
        encounter_number: encounter.encounterNumber,
      })
    } catch (error) {
      if (error instanceof ActiveEncounterExistsException) {
        return response.conflict({
          message: `This patient already has an active encounter (${this.activeEncounterNumber(
            error
          )}). Close it first.`,
          reason: 'active_encounter_exists',
        })
      }
      if (error instanceof PatientNotEligibleForEncounterException) {
        return response.unprocessableEntity({ message: error.message, reason: error.reason })
      }
      throw error
    }
  }

  private async syncCalendarEvent(appointment: Appointment, staffId: number): Promise<void> {
    await appointment.load('patient')
    const patient = appointment.patient
    const descriptionParts = [
      appointment.reason,
      patient?.patientId ? `Patient ID: ${patient.patientId}` : null,
    ].filter((v): v is string => !!v)
    const description = descriptionParts.join('\n')

    await CalendarEvent.updateOrCreate(
      { appointmentId: appointment.id },
      {
        title: `${patient?.fullName ?? 'Patient'} — ${appointment.appointmentType}`.trim(),
        description: description !== '' ? description : null,
        eventDate: appointment.confirmedDate ?? appointment.preferredDate,
        startTime: appointment.confirmedTime ?? appointment.preferredTime,
        endTime: null,
        eventType: 'appointment',
        location: null,
        createdBy: staffId,
      }
    )
  }

  private activeEncounterNumber(error: ActiveEncounterExistsException): string {
    const match = error.message.match(/\[([^\]]+)\]/)
    return match?.[1] ?? ''
  }

  private paginationMeta(
    paginator: { currentPage: number; lastPage: number; perPage: number; total: number },
    itemCount: number
  ): Record<string, number | null> {
    const from = paginator.total === 0 ? null : (paginator.currentPage - 1) * paginator.perPage + 1
    const to = from === null ? null : from + itemCount - 1
    return {
      current_page: paginator.currentPage,
      last_page: paginator.lastPage,
      per_page: paginator.perPage,
      total: paginator.total,
      from,
      to,
    }
  }

  private profilePhotoUrl(patient: Patient): string | null {
    return patient.profilePhotoPath ? `/storage/${patient.profilePhotoPath}` : null
  }

  private age(dob: DateTime | null): number | null {
    if (!dob) {
      return null
    }
    return Math.floor(DateTime.now().diff(dob, 'years').years)
  }

  private fmtDate(value: DateTime | null): string | null {
    return value ? value.toISODate() : null
  }

  private fmtTime(value: string | null): string | null {
    if (!value) {
      return null
    }
    return value.slice(0, 5)
  }
}
