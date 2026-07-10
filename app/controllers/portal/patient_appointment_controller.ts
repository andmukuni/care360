import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Appointment from '#models/appointment'
import Patient from '#models/patient'
import PortalController from '#controllers/portal/portal_controller'
import PatientAppointmentService from '#services/portal/patient_appointment_service'
import PortalDoctorsCatalog from '#services/portal/portal_doctors_catalog'

// Ported from config/appointments.php (no Adonis config equivalent yet).
const APPOINTMENT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Dental', 'Other']
const APPOINTMENT_PURPOSES = [
  'Consultation',
  'Review / Follow-up',
  'Results review',
  'Procedure',
  'Other',
]

const storeValidator = vine.compile(
  vine.object({
    patient_id: vine.number().optional(),
    appointment_type: vine.enum(APPOINTMENT_TYPES),
    appointment_type_other: vine.string().maxLength(80).nullable().optional(),
    appointment_purpose: vine.enum(APPOINTMENT_PURPOSES),
    preferred_date: vine.string(),
    preferred_time: vine.string().nullable().optional(),
    preferred_provider_id: vine.number().nullable().optional(),
    reception_type: vine.enum(['in_person', 'online']).nullable().optional(),
    alternate_date: vine.string().nullable().optional(),
    alternate_time: vine.string().nullable().optional(),
    reason: vine.string().maxLength(2000).nullable().optional(),
  })
)

const rescheduleValidator = vine.compile(
  vine.object({
    preferred_date: vine.string(),
    preferred_time: vine.string().nullable().optional(),
    alternate_date: vine.string().nullable().optional(),
    alternate_time: vine.string().nullable().optional(),
    reason: vine.string().maxLength(2000).nullable().optional(),
  })
)

/**
 * Patient portal appointments. Ported from Portal\PatientAppointmentController.
 */
export default class PatientAppointmentController extends PortalController {
  private appointmentService = new PatientAppointmentService()
  private doctors = new PortalDoctorsCatalog()

  async index(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const patient = await this.subjectPatient(ctx)

    return ctx.inertia.render('portal/appointments/index', {
      guardian,
      patient,
      appointments: (await this.appointmentService.paginatedForPatient(patient, 15, ctx.request.input('page', 1))).toJSON(),
      upcoming: await this.appointmentService.upcoming(patient),
      pending: await this.appointmentService.pending(patient),
    })
  }

  async create(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const patient = await this.subjectPatient(ctx)
    const dependents = await this.dependentResolver.authorizedDependents(guardian)

    let selectedDoctor = null
    const doctorId = Number(ctx.request.input('doctor'))
    if (doctorId) {
      selectedDoctor = await this.doctors.findActive(doctorId)
    }
    const reception = ctx.request.input('reception')
    const receptionType = ['in_person', 'online'].includes(reception) ? reception : null

    return ctx.inertia.render('portal/appointments/create', {
      guardian,
      patient,
      dependents,
      appointmentTypes: APPOINTMENT_TYPES,
      appointmentPurposes: APPOINTMENT_PURPOSES,
      selectedDoctor,
      receptionType,
    })
  }

  /**
   * PORT-GAP: Laravel used ProviderAvailabilityService to list providers
   * rostered for a date. That service has no Adonis equivalent yet, so this
   * returns all portal-bookable doctors as candidate providers.
   */
  async availableProviders(ctx: HttpContext) {
    return ctx.response.json({ providers: await this.doctors.allActive() })
  }

  async store(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const validated = await ctx.request.validateUsing(storeValidator)

    const subject = validated.patient_id
      ? await Patient.findOrFail(validated.patient_id)
      : await this.subjectPatient(ctx)

    const appointmentType =
      validated.appointment_type === 'Other' && validated.appointment_type_other
        ? validated.appointment_type_other
        : validated.appointment_type

    await this.appointmentService.createRequest(guardian, subject, {
      appointment_type: appointmentType,
      appointment_purpose: validated.appointment_purpose,
      preferred_provider_id: validated.preferred_provider_id ?? null,
      preferred_date: validated.preferred_date,
      preferred_time: validated.preferred_time ?? null,
      alternate_date: validated.alternate_date ?? null,
      alternate_time: validated.alternate_time ?? null,
      reason: validated.reason ?? null,
    })

    ctx.session.flash('success', 'Appointment request submitted. The hospital will confirm your slot.')
    return ctx.response.redirect('/portal/appointments')
  }

  async show(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const appointment = await Appointment.findOrFail(ctx.params.appointment)
    const scoped = await this.appointmentService.appointmentForGuardian(guardian, appointment)
    await scoped.load('patient')
    await scoped.load('encounters')

    return ctx.inertia.render('portal/appointments/show', {
      guardian,
      appointment: scoped,
      encounter: scoped.encounters?.[0] ?? null,
    })
  }

  async update(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const appointment = await Appointment.findOrFail(ctx.params.appointment)
    const scoped = await this.appointmentService.appointmentForGuardian(guardian, appointment)
    const validated = await ctx.request.validateUsing(rescheduleValidator)

    await this.appointmentService.reschedule(guardian, scoped, {
      preferred_date: validated.preferred_date,
      preferred_time: validated.preferred_time ?? null,
      alternate_date: validated.alternate_date ?? null,
      alternate_time: validated.alternate_time ?? null,
      reason: validated.reason ?? null,
    })

    ctx.session.flash('success', 'Reschedule request submitted.')
    return ctx.response.redirect(`/portal/appointments/${scoped.id}`)
  }

  async cancel(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const appointment = await Appointment.findOrFail(ctx.params.appointment)
    const scoped = await this.appointmentService.appointmentForGuardian(guardian, appointment)
    const reason = ctx.request.input('cancellation_reason', null)

    await this.appointmentService.cancel(guardian, scoped, reason)

    ctx.session.flash('success', 'Appointment cancelled.')
    return ctx.response.redirect('/portal/appointments')
  }
}
