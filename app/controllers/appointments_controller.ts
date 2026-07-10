import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Appointment from '#models/appointment'
import CalendarEvent from '#models/calendar_event'
import { EncounterStage } from '#enums/encounter_stage'
import StartEncounterFromAppointmentAction from '#actions/encounter/start_encounter_from_appointment_action'
import {
  ActiveEncounterExistsException,
  PatientNotEligibleForEncounterException,
} from '#support/encounter/exceptions'

/**
 * Registration-desk appointment review. Ported from App\Http\Controllers\AppointmentController.
 *
 * There is no Adonis port of App\Services\Appointment\StaffAppointmentService, so
 * the pending/confirmed/today querying and confirm/decline mutations are performed
 * inline here. Two side-effects from the Laravel service are STUBBED:
 *   - the patient AppointmentStatusNotification (no notification pipeline yet) — skipped;
 *   - the confirm/decline calendar-event sync IS reproduced (CalendarEvent upsert/delete).
 * The Laravel `show` also loaded `requestedBy` (a User); the Adonis Appointment model
 * only has `requestedByPatient`, so that patient relation is surfaced instead.
 */
const QUEUEABLE_STAGES = ['triage', 'screening', 'lab', 'screening_review', 'pharmacy'] as const

export default class AppointmentsController {
  async index({ request, inertia }: HttpContext) {
    let tab = String(request.qs().tab ?? 'pending')
    if (!['pending', 'confirmed', 'today'].includes(tab)) {
      tab = 'pending'
    }

    const today = DateTime.now().toISODate()!

    const query = Appointment.query()
      .preload('patient', (q) => q.select('id', 'patientId', 'fullName', 'gender', 'phoneNumber'))
      .preload('preferredProvider', (q) => q.select('id', 'name'))

    if (tab === 'confirmed') {
      query
        .where('status', 'confirmed')
        .where((w) => {
          w.where('confirmedDate', '>=', today).orWhere((w2) => {
            w2.whereNull('confirmedDate').where('preferredDate', '>=', today)
          })
        })
        .orderBy('confirmedDate')
        .orderBy('preferredDate')
    } else if (tab === 'today') {
      query.where('status', 'confirmed').where('confirmedDate', today).orderBy('confirmedTime')
    } else {
      query.where('status', 'pending').orderBy('preferredDate')
    }

    const appointments = await query

    const pendingRow = await db.from('appointments').where('status', 'pending').count('* as count').first()
    const pendingCount = Number(pendingRow?.count ?? 0)

    return inertia.render('appointments/index', {
      tab,
      pendingCount,
      appointments: appointments.map((a) => ({
        id: a.id,
        appointmentType: a.appointmentType,
        appointmentPurpose: a.appointmentPurpose,
        reason: a.reason,
        status: a.status,
        preferredDate: a.preferredDate ? a.preferredDate.toISODate() : null,
        preferredTime: this.fmtTime(a.preferredTime),
        confirmedDate: a.confirmedDate ? a.confirmedDate.toISODate() : null,
        confirmedTime: this.fmtTime(a.confirmedTime),
        provider: a.preferredProvider?.name ?? null,
        patient: a.patient
          ? {
              id: a.patient.id,
              patientNumber: a.patient.patientId,
              fullName: a.patient.fullName,
              gender: a.patient.gender,
              phoneNumber: a.patient.phoneNumber,
            }
          : null,
      })),
    })
  }

  async show({ params, inertia }: HttpContext) {
    const appointment = await Appointment.query()
      .where('id', params.appointment)
      .preload('patient')
      .preload('requestedByPatient', (q) => q.select('id', 'patientId', 'fullName'))
      .preload('confirmedByUser', (q) => q.select('id', 'name'))
      .preload('preferredProvider', (q) => q.select('id', 'name'))
      .preload('encounters', (q) =>
        q
          .orderBy('id', 'desc')
          .preload('startedByUser', (u) => u.select('id', 'name'))
          .preload('encounterAudits', (au) =>
            au.orderBy('id', 'desc').preload('actionByUser', (u) => u.select('id', 'name'))
          )
      )
      .firstOrFail()

    const a = appointment
    const encounter = a.encounters?.[0] ?? null

    return inertia.render('appointments/show', {
      appointment: {
        id: a.id,
        appointmentType: a.appointmentType,
        appointmentPurpose: a.appointmentPurpose,
        reason: a.reason,
        status: a.status,
        preferredDate: a.preferredDate ? a.preferredDate.toISODate() : null,
        preferredTime: this.fmtTime(a.preferredTime),
        alternateDate: a.alternateDate ? a.alternateDate.toISODate() : null,
        alternateTime: this.fmtTime(a.alternateTime),
        confirmedDate: a.confirmedDate ? a.confirmedDate.toISODate() : null,
        confirmedTime: this.fmtTime(a.confirmedTime),
        provider: a.preferredProvider?.name ?? null,
        requestedBy: a.requestedByPatient?.fullName ?? null,
        confirmedBy: a.confirmedByUser?.name ?? null,
        staffNotes: a.staffNotes,
        cancellationReason: a.cancellationReason,
        createdAt: a.createdAt ? a.createdAt.toISO() : null,
        patient: a.patient
          ? {
              id: a.patient.id,
              patientNumber: a.patient.patientId,
              fullName: a.patient.fullName,
              gender: a.patient.gender,
              nrcNumber: a.patient.nrcNumber,
              phoneNumber: a.patient.phoneNumber,
            }
          : null,
        encounter: encounter
          ? {
              id: encounter.id,
              encounterNumber: encounter.encounterNumber,
              currentStage: encounter.currentStage,
              currentStatus: encounter.currentStatus,
              startedBy: encounter.startedByUser?.name ?? null,
              audits: encounter.encounterAudits.map((au) => ({
                id: au.id,
                actionName: au.actionName,
                actionStage: au.actionStage,
                actionBy: au.actionByUser?.name ?? null,
                notes: au.notes,
                createdAt: au.createdAt ? au.createdAt.toISO() : null,
              })),
            }
          : null,
      },
    })
  }

  async confirm({ params, request, response, session, auth }: HttpContext) {
    const appointment = await Appointment.findOrFail(params.appointment)
    const validator = vine.compile(
      vine.object({
        confirmed_date: vine.string().trim(),
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
      confirmedDate: DateTime.fromISO(data.confirmed_date),
      confirmedTime: data.confirmed_time ?? null,
      confirmedBy: auth.user?.id ?? null,
      staffNotes: data.staff_notes ?? null,
    })
    await appointment.save()

    await this.syncCalendarEvent(appointment, auth.user?.id ?? 0)
    // STUB: patient AppointmentStatusNotification('confirmed') not sent (no notification pipeline).

    session.flash('success', 'Appointment confirmed.')
    return response.redirect().back()
  }

  async decline({ params, request, response, session, auth }: HttpContext) {
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
      confirmedBy: auth.user?.id ?? null,
    })
    await appointment.save()

    await CalendarEvent.query().where('appointmentId', appointment.id).delete()
    // STUB: patient AppointmentStatusNotification('declined') not sent (no notification pipeline).

    session.flash('success', 'Appointment declined.')
    return response.redirect().back()
  }

  async queue({ params, request, response, session, auth }: HttpContext) {
    const appointment = await Appointment.query()
      .where('id', params.appointment)
      .preload('patient')
      .firstOrFail()

    const validator = vine.compile(
      vine.object({
        stage: vine.enum(QUEUEABLE_STAGES),
        notes: vine.string().trim().maxLength(2000).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    if (appointment.status !== 'confirmed') {
      session.flash('error', 'Only confirmed appointments can be queued.')
      return response.redirect().back()
    }
    if (!appointment.patient) {
      session.flash('error', 'This appointment has no linked patient.')
      return response.redirect().back()
    }

    const stage = data.stage as EncounterStage
    const action = new StartEncounterFromAppointmentAction()

    try {
      const encounter = await action.handle(appointment, stage, auth.user?.id ?? 0, data.notes ?? null)
      session.flash(
        'success',
        `Encounter ${encounter.encounterNumber} started and queued to ${stage.replace(/_/g, ' ')}.`
      )
    } catch (error) {
      if (error instanceof ActiveEncounterExistsException) {
        session.flash('error', error.message)
      } else if (error instanceof PatientNotEligibleForEncounterException) {
        session.flash('error', error.message)
      } else {
        session.flash('error', error instanceof Error ? error.message : 'Could not queue appointment.')
      }
    }

    return response.redirect().back()
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

  private fmtTime(value: string | null): string | null {
    if (!value) {
      return null
    }
    return value.slice(0, 5)
  }
}
