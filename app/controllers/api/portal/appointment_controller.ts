import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import Appointment from '#models/appointment'
import Encounter from '#models/encounter'
import Patient from '#models/patient'
import ShiftRoster from '#models/shift_roster'
import User from '#models/user'
import PatientAppointmentService, {
  type CreateAppointmentData,
} from '#services/portal/patient_appointment_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import { abortUnless } from '#services/portal/portal_errors'

/**
 * Appointment booking & management for the patient (self + authorized dependents).
 *
 * Ported from App\Http\Controllers\Api\Portal\AppointmentController. Delegates to
 * PatientAppointmentService (portal) and reproduces the AppointmentResource /
 * EncounterResource JSON shapes inline (this app has no Laravel-style resource
 * classes).
 *
 * PORT-GAP: App\Services\Appointment\ProviderAvailabilityService and the
 * App\Support\Appointments\* helpers (AppointmentPresenter, DoctorBookingContext,
 * PortalAppointmentMessages) are not ported. Their (small) logic is inlined here.
 * The provider-availability check is a best-effort reproduction against the
 * shift_rosters table (config('appointments.provider_shift_type') = 'day',
 * provider_roles empty ⇒ no role filter).
 */

const APPOINTMENT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Dental', 'Other']
const APPOINTMENT_PURPOSES = [
  'Consultation',
  'Review / Follow-up',
  'Results review',
  'Procedure',
  'Other',
]
const PROVIDER_SHIFT_TYPE = 'day'

const optionsValidator = vine.compile(
  vine.object({
    date: vine.string().optional().nullable(),
  })
)

const storeValidator = vine.compile(
  vine.object({
    patient_id: vine.number().optional().nullable(),
    appointment_type: vine.enum(APPOINTMENT_TYPES),
    appointment_type_other: vine.string().maxLength(80).optional().nullable(),
    appointment_purpose: vine.enum(APPOINTMENT_PURPOSES),
    preferred_date: vine.string(),
    preferred_time: vine
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .nullable(),
    preferred_provider_id: vine.number().optional().nullable(),
    reception_type: vine.enum(['in_person', 'online']).optional().nullable(),
    alternate_date: vine.string().optional().nullable(),
    alternate_time: vine
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .nullable(),
    reason: vine.string().maxLength(2000).optional().nullable(),
  })
)

const updateValidator = vine.compile(
  vine.object({
    preferred_date: vine.string(),
    preferred_time: vine
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .nullable(),
    alternate_date: vine.string().optional().nullable(),
    alternate_time: vine
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .nullable(),
    reason: vine.string().maxLength(2000).optional().nullable(),
  })
)

const cancelValidator = vine.compile(
  vine.object({
    cancellation_reason: vine.string().maxLength(500).optional().nullable(),
  })
)

export default class AppointmentController {
  private readonly appointmentService = new PatientAppointmentService()
  private readonly dependentResolver = new PatientDependentResolver()
  private readonly medicalSummary = new PatientMedicalSummaryService()

  async index(ctx: HttpContext) {
    const subject = await this.subjectPatient(ctx)
    const page = Number(ctx.request.input('page', 1)) || 1
    const paginator = await this.appointmentService.paginatedForPatient(subject, 15, page)

    return ctx.response.ok(
      paginatedResource<Appointment>(ctx, paginator, (appointment) =>
        this.appointmentToArray(appointment)
      )
    )
  }

  async options(ctx: HttpContext) {
    const { date } = await ctx.request.validateUsing(optionsValidator)

    return ctx.response.ok({
      types: APPOINTMENT_TYPES,
      purposes: APPOINTMENT_PURPOSES,
      providers: date ? await this.availableProvidersForDate(date) : [],
    })
  }

  async store(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const validated = await ctx.request.validateUsing(storeValidator)

    // Mirror Laravel required_if:appointment_type,Other.
    if (validated.appointment_type === 'Other' && !String(validated.appointment_type_other ?? '').trim()) {
      return ctx.response.unprocessableEntity({
        errors: {
          appointment_type_other: ['Please describe the appointment type.'],
        },
      })
    }

    const providerError = await this.preferredProviderErrors(
      validated.preferred_provider_id ?? null,
      validated.preferred_date
    )
    if (providerError) {
      return ctx.response.unprocessableEntity({ errors: providerError })
    }

    const appointmentType = resolveType(
      validated.appointment_type,
      validated.appointment_type_other ?? null
    )

    const subject =
      validated.patient_id != null
        ? await Patient.findOrFail(validated.patient_id)
        : await this.subjectPatient(ctx)

    abortUnless(await this.dependentResolver.canBookForPatient(guardian, subject), 403)

    const data: CreateAppointmentData = applyDoctorBookingContext({
      appointment_type: appointmentType,
      appointment_purpose: validated.appointment_purpose,
      preferred_provider_id: validated.preferred_provider_id ?? null,
      preferred_date: validated.preferred_date,
      preferred_time: validated.preferred_time ?? null,
      alternate_date: validated.alternate_date ?? null,
      alternate_time: validated.alternate_time ?? null,
      reason: validated.reason ?? null,
      reception_type: validated.reception_type ?? null,
    })

    const appointment = await this.appointmentService.createRequest(guardian, subject, data)
    await appointment.load('preferredProvider')

    return ctx.response.created({
      data: this.appointmentToArray(appointment),
      message: 'Appointment request submitted. The hospital will confirm your slot.',
    })
  }

  async show(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    let appointment = await Appointment.findOrFail(ctx.params.appointment ?? ctx.params.id)
    appointment = await this.appointmentService.appointmentForGuardian(guardian, appointment)

    await appointment.load('patient')
    await appointment.load('requestedByPatient')
    await appointment.load('preferredProvider')
    await appointment.load('confirmedByUser')

    let encounterPayload: Record<string, unknown> | null = null
    const encounter = await Encounter.query().where('appointmentId', appointment.id).first()
    if (encounter && appointment.patient) {
      const full = await this.medicalSummary.encounterForPatient(appointment.patient, encounter)
      const diagnoses = await this.medicalSummary.diagnosisSummaryForEncounter(full)
      encounterPayload = this.encounterToArray(full, diagnoses)
    }

    return ctx.response.ok({
      data: this.appointmentToArray(appointment, { encounter: encounterPayload }),
    })
  }

  async update(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    let appointment = await Appointment.findOrFail(ctx.params.appointment ?? ctx.params.id)
    appointment = await this.appointmentService.appointmentForGuardian(guardian, appointment)

    const validated = await ctx.request.validateUsing(updateValidator)

    appointment = await this.appointmentService.reschedule(guardian, appointment, {
      preferred_date: validated.preferred_date,
      preferred_time: validated.preferred_time ?? null,
      alternate_date: validated.alternate_date ?? null,
      alternate_time: validated.alternate_time ?? null,
      reason: validated.reason ?? null,
    })
    await appointment.load('preferredProvider')

    return ctx.response.ok({ data: this.appointmentToArray(appointment) })
  }

  async cancel(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    let appointment = await Appointment.findOrFail(ctx.params.appointment ?? ctx.params.id)
    appointment = await this.appointmentService.appointmentForGuardian(guardian, appointment)

    const validated = await ctx.request.validateUsing(cancelValidator)

    appointment = await this.appointmentService.cancel(
      guardian,
      appointment,
      validated.cancellation_reason ?? null
    )
    await appointment.load('preferredProvider')

    return ctx.response.ok({ data: this.appointmentToArray(appointment) })
  }

  // ── availability (PORT-GAP: inlined ProviderAvailabilityService) ────────────

  private async availableProvidersForDate(
    date: string
  ): Promise<Array<{ id: number; name: string; title: string | null }>> {
    const day = DateTime.fromISO(date).toISODate()
    if (!day) {
      return []
    }

    const rosters = await ShiftRoster.query()
      .where('shiftType', PROVIDER_SHIFT_TYPE)
      .where('shiftDate', day)
      .preload('user')

    const seen = new Set<number>()
    const providers: Array<{ id: number; name: string; title: string | null }> = []
    for (const roster of rosters) {
      const user = roster.user
      if (!user || seen.has(user.id) || !user.isPortalBookable) {
        continue
      }
      seen.add(user.id)
      providers.push({
        id: user.id,
        name: portalDisplayName(user),
        title: portalTitleLabel(user),
      })
    }

    return providers.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async preferredProviderErrors(
    providerId: number | null,
    preferredDate: string
  ): Promise<Record<string, string[]> | null> {
    if (!providerId) {
      return null
    }

    const bookable = await User.query()
      .where('id', providerId)
      .where('isPortalBookable', true)
      .first()
    if (!bookable) {
      return { preferred_provider_id: ['That provider is not available for patient booking.'] }
    }

    if (!(await this.isProviderAvailable(providerId, preferredDate))) {
      return {
        preferred_provider_id: [
          'That provider is not available on the selected date. Please choose another.',
        ],
      }
    }

    return null
  }

  private async isProviderAvailable(userId: number, date: string): Promise<boolean> {
    const day = DateTime.fromISO(date).toISODate()
    if (!day) {
      return false
    }

    // When no roster exists for the day, any bookable provider may be requested.
    const rosterForDay = await ShiftRoster.query()
      .where('shiftType', PROVIDER_SHIFT_TYPE)
      .where('shiftDate', day)
      .first()
    if (!rosterForDay) {
      return true
    }

    const providers = await this.availableProvidersForDate(date)

    return providers.some((provider) => provider.id === userId)
  }

  // ── auth context (mirrors ResolvesApiPatient) ───────────────────────────────

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient_api').user as Patient
  }

  private async subjectPatient(ctx: HttpContext): Promise<Patient> {
    const guardian = this.guardian(ctx)
    const header = ctx.request.header('X-Portal-Viewing-Patient-Id')
    const parsedHeader = header !== undefined && header !== '' ? Number(header) : null
    const tokenId = guardian.currentAccessToken
      ? Number(guardian.currentAccessToken.identifier)
      : null

    return this.dependentResolver.viewingPatientForApi(guardian, parsedHeader, tokenId)
  }

  // ── resource shapes ─────────────────────────────────────────────────────────

  private appointmentToArray(
    appointment: Appointment,
    opts: { encounter?: Record<string, unknown> | null } = {}
  ): Record<string, unknown> {
    const status = String(appointment.status)
    const provider = loaded<User>(appointment, 'preferredProvider') ?? null
    const providerTitle = provider ? portalTitleLabel(provider) : null
    const providerSubtitle = provider ? portalSubtitleLabel(provider) : null

    const result: Record<string, unknown> = {
      id: appointment.id,
      appointment_type: appointment.appointmentType,
      appointment_purpose: appointment.appointmentPurpose,
      reason: appointment.reason,

      status,
      status_label: statusLabel(status),
      status_tone: statusTone(status),
      is_actionable: ['pending', 'confirmed'].includes(status),

      created_at: iso(appointment.createdAt),

      preferred_date: dateStr(appointment.preferredDate),
      preferred_time: appointment.preferredTime,
      alternate_date: dateStr(appointment.alternateDate),
      alternate_time: appointment.alternateTime,

      confirmed_date: dateStr(appointment.confirmedDate),
      confirmed_time: appointment.confirmedTime,

      preferred_provider_title: providerTitle,
      preferred_provider_role: providerSubtitle,

      staff_notes: appointment.staffNotes,
      cancelled_at: iso(appointment.cancelledAt),
      cancellation_reason: appointment.cancellationReason,

      patient_id: appointment.patientId,
      is_dependent_booking:
        Number(appointment.requestedByPatientId) !== Number(appointment.patientId),
    }

    // whenLoaded fields (key omitted entirely when the relation is not loaded).
    if (isLoaded(appointment, 'confirmedByUser')) {
      const confirmedBy = loaded<User>(appointment, 'confirmedByUser') ?? null
      result.confirmed_by_name = confirmedBy?.name ?? null
    }
    if (isLoaded(appointment, 'preferredProvider')) {
      result.preferred_provider_name = provider ? portalDisplayName(provider) : null
      result.preferred_provider_photo_url = provider ? profilePhotoUrl(provider) : null
    }
    if (isLoaded(appointment, 'patient')) {
      const patient = loaded<Patient>(appointment, 'patient') ?? null
      result.patient_name = patient?.fullName ?? null
      result.patient_number = patient?.patientId ?? null
    }
    if (isLoaded(appointment, 'requestedByPatient')) {
      const requestedBy = loaded<Patient>(appointment, 'requestedByPatient') ?? null
      result.requested_by_name = requestedBy?.fullName ?? null
    }

    if (opts.encounter != null) {
      result.encounter = opts.encounter
    }

    return result
  }

  /**
   * PORT-GAP: the Laravel EncounterResource reads singular relations
   * (triageRecord, labRequest.results, prescriptions). The AdonisJS Encounter
   * model / medical-summary service expose the equivalent plural relations
   * (triageRecords, labRequests.labResults, pharmacyPrescriptions), so this
   * reproduction reads those instead.
   */
  private encounterToArray(encounter: Encounter, diagnoses: string[]): Record<string, unknown> {
    const stage = encounter.currentStage ? String(encounter.currentStage) : ''
    const status = encounter.currentStatus ? String(encounter.currentStatus) : ''
    const triage = (loaded<any[]>(encounter, 'triageRecords') ?? [])[0] ?? null

    const labResults: Record<string, unknown>[] = []
    for (const request of loaded<any[]>(encounter, 'labRequests') ?? []) {
      for (const result of request.labResults ?? []) {
        labResults.push(labResultToArray(result))
      }
    }

    const prescriptions = (loaded<any[]>(encounter, 'pharmacyPrescriptions') ?? []).map(
      (prescription) => prescriptionToArray(prescription)
    )

    return {
      id: encounter.id,
      encounter_number: encounter.encounterNumber,
      visit_type: encounter.visitType,
      stage: stage || null,
      stage_label: stage ? humanize(stage) : null,
      status: status || null,
      status_label: status ? humanize(status) : null,
      priority_level: encounter.priorityLevel,
      started_at: iso(encounter.startedAt),
      closed_at: iso(encounter.closedAt),
      is_closed: stage === 'completed' || encounter.closedAt !== null,
      closure_notes: encounter.closureNotes,

      diagnoses: diagnoses ?? [],

      vitals: triage
        ? {
            recorded_at: iso(triage.triageAt),
            weight: triage.weight,
            height: triage.height,
            bmi: triage.bmi,
            temperature: triage.temperature,
            pulse: triage.pulse,
            respiratory_rate: triage.respiratoryRate,
            systolic_bp: triage.systolicBp,
            diastolic_bp: triage.diastolicBp,
            oxygen_saturation: triage.oxygenSaturation,
            blood_sugar: triage.bloodSugar,
            pain_scale: triage.painScale,
            chief_complaint: triage.chiefComplaintBrief,
          }
        : null,

      lab_results: labResults,
      prescriptions,
    }
  }
}

// ── local helpers ─────────────────────────────────────────────────────────────

function loaded<T>(model: any, name: string): T | undefined {
  const preloaded = model?.$preloaded
  return preloaded && name in preloaded ? (preloaded[name] as T) : undefined
}

function isLoaded(model: any, name: string): boolean {
  const preloaded = model?.$preloaded
  return Boolean(preloaded && name in preloaded)
}

function iso(dt: DateTime | null | undefined): string | null {
  return dt ? dt.toISO({ suppressMilliseconds: true }) : null
}

function dateStr(dt: DateTime | null | undefined): string | null {
  return dt ? dt.toISODate() : null
}

function ucfirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function humanize(value: string): string {
  return ucfirst(value.replace(/_/g, ' '))
}

/** Inlined App\Support\Appointments\AppointmentPresenter::statusLabel(). */
function statusLabel(status: string): string {
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
      return ucfirst(status)
  }
}

/** Inlined App\Support\Appointments\AppointmentPresenter::statusTone(). */
function statusTone(status: string): string {
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

/** Inlined App\Support\Appointments\AppointmentPresenter::resolveType(). */
function resolveType(type: string, other: string | null): string {
  if (type === 'Other') {
    const trimmed = String(other ?? '').trim()
    return trimmed !== '' ? trimmed : 'Other'
  }

  return type
}

/** Inlined App\Support\Appointments\DoctorBookingContext::apply(). */
function applyDoctorBookingContext(
  data: CreateAppointmentData & { reception_type?: string | null }
): CreateAppointmentData {
  const reception = data.reception_type ?? null
  delete (data as { reception_type?: string | null }).reception_type

  if (!reception) {
    return data
  }

  const prefix = reception === 'online' ? 'Reception: Online / video' : 'Reception: In person'
  const notes = String(data.reason ?? '').trim()
  data.reason = notes !== '' ? `${prefix}\n\n${notes}` : prefix

  return data
}

function portalDisplayName(user: User): string {
  const title = (user.title ?? '').trim()
  return title !== '' ? `${title} ${user.name}` : user.name
}

function portalTitleLabel(user: User): string | null {
  const title = (user.title ?? '').trim()
  return title !== '' ? title : null
}

function portalSubtitleLabel(user: User): string | null {
  const specialty = user.specialty && user.specialty.trim() !== '' ? user.specialty.trim() : null
  if (specialty !== null) {
    return specialty
  }

  const title = portalTitleLabel(user)
  if (title === null) {
    return null
  }

  if (portalDisplayName(user).toLowerCase().startsWith(title.toLowerCase())) {
    return null
  }

  return title
}

function profilePhotoUrl(user: User): string | null {
  return user.profilePhotoPath ? `/storage/${user.profilePhotoPath}` : null
}

function labResultToArray(result: any): Record<string, unknown> {
  const item = result.labRequestItem ?? null

  return {
    id: result.id,
    test_name: item?.testName ?? result.resultText ?? 'Lab result',
    test_code: item?.testCode ?? null,
    specimen_type: item?.specimenType ?? null,

    result_value: result.resultValue,
    result_text: result.resultText,
    reference_range: result.referenceRange,
    interpretation: result.interpretation,
    remarks: result.remarks,

    status: result.resultStatus,
    status_label: result.resultStatus ? humanize(String(result.resultStatus)) : null,

    recorded_at: iso(result.resultRecordedAt),
    released_at: iso(result.releasedToPatientAt),

    encounter_id: result.encounterId,
  }
}

function prescriptionToArray(prescription: any): Record<string, unknown> {
  const status = String(prescription.status ?? '')
  const items = (prescription.pharmacyPrescriptionItems ?? []).map((item: any) =>
    prescriptionItemToArray(item)
  )

  return {
    id: prescription.id,
    prescription_number: prescription.prescriptionNumber,
    status: status || null,
    status_label: status ? humanize(status) : null,
    notes: prescription.notes,
    prescribed_at: iso(prescription.prescribedAt),
    encounter_id: prescription.encounterId,
    items,
  }
}

function prescriptionItemToArray(item: any): Record<string, unknown> {
  const frequency = [item.frequency, item.frequencyUnit].filter((part) => Boolean(part)).join(' ').trim()
  const duration = [item.duration, item.durationUnit].filter((part) => Boolean(part)).join(' ').trim()

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

/**
 * Reproduces Laravel's paginated resource-collection JSON (data + links + meta)
 * for endpoints that return a resource collection over a paginator as the root
 * response body.
 */
function paginatedResource<T>(
  ctx: HttpContext,
  paginator: any,
  map: (row: T) => Record<string, unknown>
): Record<string, unknown> {
  const path = ctx.request.completeUrl(false)
  const perPage = Number(paginator.perPage)
  const currentPage = Number(paginator.currentPage)
  const lastPage = Number(paginator.lastPage)
  const total = Number(paginator.total)
  const rows = paginator.all() as T[]
  const count = rows.length
  const from = total === 0 ? null : (currentPage - 1) * perPage + 1
  const to = total === 0 || from === null ? null : from + count - 1
  const pageUrl = (page: number) => `${path}?page=${page}`

  const metaLinks: Array<{ url: string | null; label: string; active: boolean }> = []
  metaLinks.push({
    url: currentPage > 1 ? pageUrl(currentPage - 1) : null,
    label: '&laquo; Previous',
    active: false,
  })
  for (let page = 1; page <= lastPage; page++) {
    metaLinks.push({ url: pageUrl(page), label: String(page), active: page === currentPage })
  }
  metaLinks.push({
    url: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    label: 'Next &raquo;',
    active: false,
  })

  return {
    data: rows.map(map),
    links: {
      first: pageUrl(1),
      last: pageUrl(lastPage),
      prev: currentPage > 1 ? pageUrl(currentPage - 1) : null,
      next: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    },
    meta: {
      current_page: currentPage,
      from,
      last_page: lastPage,
      links: metaLinks,
      path,
      per_page: perPage,
      to,
      total,
    },
  }
}
