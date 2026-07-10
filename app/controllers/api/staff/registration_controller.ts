import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Encounter from '#models/encounter'
import Patient from '#models/patient'
import type User from '#models/user'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import StartEncounterAction from '#actions/encounter/start_encounter_action'
import SearchPatientAction from '#actions/encounter/search_patient_action'
import QueueEncounterToTriageAction from '#actions/encounter/queue_encounter_to_triage_action'
import { findPatientRowByRef } from '#support/ref_resolvers'
import QueueCache from '#services/cache/queue_cache'
import { apiStageQueueKey } from '#services/cache/queue_cache_keys'
import {
  ActiveEncounterExistsException,
  PatientNotEligibleForEncounterException,
} from '#support/encounter/exceptions'
import { startEncounterValidator } from '#validators/staff/registration'

/**
 * Registration desk API consumed by the Electron desktop app. Ported from
 * App\Http\Controllers\Api\Staff\RegistrationController.
 *
 * Thin token-authenticated wrapper over the same encounter actions the web desk
 * uses (SearchPatientAction, StartEncounterAction, QueueEncounterToTriageAction).
 *
 * PORT-GAPs:
 *  - config/encounter.php has no Adonis port, so `reference()` inlines the visit
 *    types / priority levels (kept in step with StartEncounterRequest).
 *  - ActiveEncounterExistsException does not expose the offending encounter, only
 *    its message, so the encounter number is parsed out of the message text.
 *  - startAndQueue() cannot run both actions in a single outer transaction:
 *    QueueEncounterToTriageAction manages its own transaction and does not accept
 *    an external client, so the two steps are run sequentially (not atomic).
 */
const QUEUE_STAGES = ['triage', 'screening', 'lab', 'screening_review', 'pharmacy', 'treatment_room']
const ALLOWED_PER_PAGE = [25, 50, 100]

// Mirrors config/encounter.php (no Adonis config equivalent exists).
const VISIT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Admission', 'Appointment', 'Other']
const PRIORITY_LEVELS: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  emergency: 'Emergency',
}

export default class RegistrationController {
  /**
   * GET /api/v1/staff/reference — form metadata for the desktop dropdowns.
   */
  async reference({ response }: HttpContext) {
    const villageRows = await db.from('villages').select('name').orderBy('name')

    return response.ok({
      visit_types: VISIT_TYPES,
      priority_levels: Object.entries(PRIORITY_LEVELS).map(([value, label]) => ({ value, label })),
      genders: ['male', 'female', 'other'],
      villages: villageRows.map((v) => v.name),
      payment_plans: ['monthly', 'annual'],
      payment_modes: ['cash', 'mobile_money'],
      payment_amounts: [
        { plan: 'monthly', amount: 500 },
        { plan: 'annual', amount: 6000 },
      ],
    })
  }

  /**
   * GET /api/v1/staff/lookup?code=... — resolve a scanned QR/barcode to a
   * single patient by exact patient_id or barcode match.
   */
  async lookup({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        code: vine.string().maxLength(191),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })
    const code = validated.code.trim()

    const row = await findPatientRowByRef(code)

    if (!row) {
      return response.notFound({
        message: 'No patient matches that code. Use manual search, or register them as a new patient.',
        code,
      })
    }

    const patient = await Patient.findOrFail(Number(row.id))
    const activeEncounter = await this.loadActiveEncounter(patient.id)

    return response.ok({ patient: this.patientCard(patient, activeEncounter) })
  }

  /**
   * GET /api/v1/staff/patients?q=&page=&per_page=&sex=&status=
   */
  async patients({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        q: vine.string().maxLength(100).optional(),
        sex: vine.enum(['male', 'female']).optional(),
        status: vine.enum(['active', 'inactive', 'deceased']).optional(),
        page: vine.number().min(1).optional(),
        per_page: vine.number().optional(),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })

    const perPage = ALLOWED_PER_PAGE.includes(validated.per_page ?? 25) ? validated.per_page! : 25
    const page = validated.page ?? 1
    const q = validated.q ? validated.q.trim() : ''

    const query = Patient.query()

    if (validated.sex) {
      query.whereRaw('LOWER(gender) = ?', [validated.sex.toLowerCase()])
    }

    if (validated.status === 'deceased') {
      query.where('is_deceased', true)
    } else if (validated.status) {
      query.where('status', validated.status).where('is_deceased', false)
    }

    if (q !== '') {
      const tokens = q.split(/\s+/).filter((t) => t.length > 0)
      query.where((sub) => {
        sub
          .where('patient_id', q)
          .orWhere('barcode', q)
          .orWhereILike('nrc_number', `%${q}%`)
          .orWhereILike('phone_number', `%${q}%`)
          .orWhereILike('art_number', `%${q}%`)
          .orWhereILike('nupn', `%${q}%`)
          .orWhereILike('full_name', `%${q}%`)
          .orWhere((nameSub) => {
            for (const token of tokens) {
              nameSub.whereILike('full_name', `%${token}%`)
            }
          })
      })
    }

    const paginator = await query.orderBy('full_name').paginate(page, perPage)
    const items = paginator.all()

    const activeByPatient = await this.activeEncounterMap(items.map((p) => p.id))

    return response.ok({
      data: items.map((p) => {
        const active = activeByPatient.get(p.id) ?? null
        return {
          id: p.id,
          patient_number: p.patientId,
          barcode: p.barcode,
          full_name: p.fullName,
          profile_photo_url: this.profilePhotoUrl(p),
          gender: p.gender,
          date_of_birth: p.dateOfBirth?.toISODate() ?? null,
          age: this.age(p.dateOfBirth),
          phone_number: p.phoneNumber,
          nrc_number: p.nrcNumber,
          status: p.status,
          is_deceased: !!p.isDeceased,
          open_visit: active
            ? {
                encounter_number: active.encounterNumber,
                current_stage: active.currentStage,
              }
            : null,
        }
      }),
      meta: this.paginationMeta(paginator, items.length),
    })
  }

  /**
   * GET /api/v1/staff/patients/search?q=...&date_of_birth=...&sex=...
   */
  async search({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        q: vine.string().minLength(2).maxLength(100),
        date_of_birth: vine.string().nullable().optional(),
        sex: vine.enum(['male', 'female']).nullable().optional(),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })

    const patients = await new SearchPatientAction().handle(
      validated.q,
      validated.date_of_birth ?? null,
      validated.sex ?? null
    )

    return response.ok({
      patients: patients.map((p) => ({
        id: p.id,
        patient_number: p.patientId,
        barcode: p.barcode,
        full_name: p.fullName,
        gender: p.gender,
        date_of_birth: p.dateOfBirth?.toISODate() ?? null,
        age: this.age(p.dateOfBirth),
        phone_number: p.phoneNumber,
        nrc_number: p.nrcNumber,
        status: p.status,
        is_deceased: !!p.isDeceased,
      })),
      count: patients.length,
    })
  }

  /**
   * GET /api/v1/staff/households/search?q=...
   */
  async searchHouseholds({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        q: vine.string().minLength(1).maxLength(100),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })
    const like = `%${validated.q.trim()}%`

    const households = await db
      .from('households')
      .select('household_id', 'head_of_house')
      .where((builder) => {
        builder.whereILike('head_of_house', like).orWhereILike('household_id', like)
      })
      .orderBy('head_of_house')
      .orderBy('household_id')
      .limit(10)

    return response.ok({
      households: households.map((h) => ({
        id: h.household_id,
        name: h.head_of_house || 'Unnamed Household',
        label: `${h.head_of_house || 'Unnamed Household'} (${h.household_id})`,
      })),
      count: households.length,
    })
  }

  /**
   * GET /api/v1/staff/households?q=&page=&per_page=&payment_status=&plan=
   */
  async households({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        q: vine.string().maxLength(100).optional(),
        payment_status: vine.string().maxLength(30).optional(),
        plan: vine.enum(['monthly', 'annual']).optional(),
        page: vine.number().min(1).optional(),
        per_page: vine.number().optional(),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })

    const perPage = ALLOWED_PER_PAGE.includes(validated.per_page ?? 25) ? validated.per_page! : 25
    const page = validated.page ?? 1
    const q = validated.q ? validated.q.trim() : ''

    const query = db
      .from('households')
      .select('households.*')
      .select(
        db.raw(
          '(select count(*) from patients where patients.household_id = households.household_id) as member_count'
        )
      )

    if (validated.payment_status) {
      query.where('payment_status', validated.payment_status)
    }
    if (validated.plan) {
      query.where('subscription_plan', validated.plan)
    }
    if (q !== '') {
      const like = `%${q}%`
      query.where((sub) => {
        sub
          .where('household_id', q)
          .orWhere('barcode', q)
          .orWhereILike('head_of_house', like)
          .orWhereILike('nrc_number', like)
          .orWhereILike('phone_number', like)
          .orWhereILike('village', like)
      })
    }

    const paginator = await query.orderBy('head_of_house').paginate(page, perPage)
    const items = paginator.all()

    return response.ok({
      data: items.map((h) => ({
        id: h.id,
        household_id: h.household_id,
        barcode: h.barcode,
        head_of_house: h.head_of_house || 'Unnamed Household',
        nrc_number: h.nrc_number,
        phone_number: h.phone_number,
        village: h.village,
        town: h.town,
        household_type: h.household_type,
        member_count: Number(h.member_count),
        subscription_plan: h.subscription_plan,
        subscription_fee: h.subscription_fee,
        payment_status: h.payment_status,
      })),
      meta: this.paginationMeta(paginator, items.length),
    })
  }

  /**
   * GET /api/v1/staff/portal-registrations?q=&page=&per_page=
   */
  async portalRegistrations({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        q: vine.string().maxLength(100).optional(),
        page: vine.number().min(1).optional(),
        per_page: vine.number().optional(),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })

    const perPage = ALLOWED_PER_PAGE.includes(validated.per_page ?? 25) ? validated.per_page! : 25
    const page = validated.page ?? 1
    const q = validated.q ? validated.q.trim() : ''

    const query = Patient.query()
      .whereNotNull('password')
      .where('portal_enabled', false)
      .where((w) => {
        w.whereNull('is_deceased').orWhere('is_deceased', false)
      })

    if (q !== '') {
      const like = `%${q}%`
      query.where((sub) => {
        sub
          .where('patient_id', q)
          .orWhereILike('full_name', like)
          .orWhereILike('email', like)
          .orWhereILike('phone_number', like)
          .orWhereILike('nrc_number', like)
      })
    }

    const paginator = await query.orderBy('updated_at', 'desc').paginate(page, perPage)
    const items = paginator.all()

    return response.ok({
      data: items.map((p) => ({
        id: p.id,
        patient_number: p.patientId,
        full_name: p.fullName,
        profile_photo_url: this.profilePhotoUrl(p),
        email: p.email,
        phone_number: p.phoneNumber,
        gender: p.gender,
        age: this.age(p.dateOfBirth),
        nrc_number: p.nrcNumber,
        registered_at: p.updatedAt?.toISO() ?? null,
      })),
      meta: this.paginationMeta(paginator, items.length),
    })
  }

  /**
   * POST /api/v1/staff/portal-registrations/{ref}/approve
   */
  async approvePortalRegistration({ params, response }: HttpContext) {
    const patient = await this.findPortalPatient(String(params.ref))
    if (!patient) {
      return response.notFound({ message: 'Registration not found.' })
    }
    if (!patient.password || patient.password.trim() === '') {
      return response.unprocessableEntity({
        message: 'This patient has not set a portal password.',
      })
    }

    patient.merge({
      portalEnabled: true,
      status: patient.status || 'active',
      emailVerifiedAt: patient.emailVerifiedAt ?? DateTime.now(),
    })
    await patient.save()

    return response.ok({ message: `${patient.fullName} approved — they can now sign in.` })
  }

  /**
   * POST /api/v1/staff/portal-registrations/{ref}/decline
   */
  async declinePortalRegistration({ params, response }: HttpContext) {
    const patient = await this.findPortalPatient(String(params.ref))
    if (!patient) {
      return response.notFound({ message: 'Registration not found.' })
    }

    await Patient.accessTokens.deleteAll(patient)
    patient.merge({ password: null, portalEnabled: false })
    await patient.save()

    return response.ok({ message: `${patient.fullName}'s sign-up was declined.` })
  }

  /**
   * GET /api/v1/staff/households/{ref} — household detail with members.
   */
  async householdShow({ params, response }: HttpContext) {
    const ref = String(params.ref)

    const h = await db
      .from('households')
      .where('barcode', ref)
      .orWhere('household_id', ref)
      .first()

    if (!h) {
      return response.notFound({ message: 'Household not found.' })
    }

    let members = await Patient.query()
      .where('household_id', h.household_id)
      .orderByRaw("CASE WHEN LOWER(COALESCE(relationship_to_head,'')) = 'head' THEN 0 ELSE 1 END")
      .orderBy('full_name')

    if (members.length === 0 && h.head_of_house) {
      members = await Patient.query()
        .where('household_head_of_house', h.head_of_house)
        .orderBy('full_name')
    }

    return response.ok({
      household: {
        id: h.id,
        household_id: h.household_id,
        barcode: h.barcode,
        head_of_house: h.head_of_house || 'Unnamed Household',
        nrc_number: h.nrc_number,
        phone_number: h.phone_number,
        village: h.village,
        town: h.town,
        household_type: h.household_type,
        subscription_plan: h.subscription_plan,
        subscription_fee: h.subscription_fee,
        payment_method: h.payment_method,
        payment_status: h.payment_status,
        member_count: members.length,
      },
      members: members.map((p) => ({
        id: p.id,
        patient_number: p.patientId,
        barcode: p.barcode,
        full_name: p.fullName,
        profile_photo_url: this.profilePhotoUrl(p),
        gender: p.gender,
        age: this.age(p.dateOfBirth),
        relationship_to_head: p.relationshipToHead,
        phone_number: p.phoneNumber,
        status: p.status,
        is_deceased: !!p.isDeceased,
      })),
    })
  }

  /**
   * GET /api/v1/staff/queue?stage=triage — encounters at a given stage.
   */
  async stageQueue({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        stage: vine.enum(QUEUE_STAGES).optional(),
      })
    )
    const validated = await request.validateUsing(validator, { data: request.qs() })
    const stage = validated.stage ?? 'triage'

    const payload = await QueueCache.getOrSet(apiStageQueueKey(stage), stage, async () => {
      const encounters = await Encounter.query()
        .preload('patient')
        .preload('encounterQueueTransitions', (q) =>
          q.where('to_stage', stage).preload('receivedByUser', (u) => u.select('id', 'name'))
        )
        .where('current_stage', stage)
        .whereIn('current_status', [EncounterStatus.Queued, EncounterStatus.InProgress])
        .orderByRaw(
          "CASE priority_level WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END asc"
        )
        .orderBy('started_at', 'asc')
        .limit(200)

      const rows = encounters.map((e) => {
        const status =
          typeof e.currentStatus === 'string' ? e.currentStatus : String(e.currentStatus)

        const seenByTransition = (e.encounterQueueTransitions ?? [])
          .filter((t) => t.receivedBy)
          .sort((a, b) => b.id - a.id)[0]

        return {
          id: e.id,
          encounter_number: e.encounterNumber,
          status,
          priority_level: e.priorityLevel,
          visit_type: e.visitType,
          started_at: e.startedAt?.toISO() ?? null,
          waiting_since: e.updatedAt?.toISO() ?? null,
          seen_by: seenByTransition?.receivedByUser?.name ?? null,
          patient: {
            patient_number: e.patient?.patientId ?? null,
            full_name: e.patient?.fullName ?? null,
            gender: e.patient?.gender ?? null,
            age: this.age(e.patient?.dateOfBirth ?? null),
            profile_photo_url: e.patient ? this.profilePhotoUrl(e.patient) : null,
          },
        }
      })

      return {
        encounters: rows,
        counts: {
          queued: rows.filter((r) => r.status === 'queued').length,
          in_progress: rows.filter((r) => r.status === 'in_progress').length,
          total: rows.length,
        },
      }
    })

    return response.ok(payload)
  }

  /**
   * POST /api/v1/staff/encounters/start — start an encounter and queue to triage.
   */
  async startAndQueue({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user as User
    const data = await request.validateUsing(startEncounterValidator)
    const notes = data.registration_notes ?? null

    let encounter: Encounter
    try {
      // NOTE: not atomic — QueueEncounterToTriageAction manages its own
      // transaction and cannot join an external one. See PORT-GAP above.
      encounter = await new StartEncounterAction().handle(data as Record<string, any>, user.id)
      await new QueueEncounterToTriageAction().handle(encounter, user.id, notes)
      await encounter.refresh()
      await encounter.load('patient')
    } catch (error) {
      if (error instanceof ActiveEncounterExistsException) {
        const encNumber = this.activeEncounterNumber(error)
        return response.conflict({
          message: `This patient already has an active encounter (${encNumber}). Close or complete it before starting a new one.`,
          reason: 'active_encounter_exists',
          encounter_number: encNumber,
        })
      }
      if (error instanceof PatientNotEligibleForEncounterException) {
        return response.unprocessableEntity({
          message: error.message,
          reason: error.reason,
          requires_inactive_confirmation:
            error.reason === PatientNotEligibleForEncounterException.REASON_INACTIVE,
        })
      }
      throw error
    }

    return response.created({
      message: `Encounter ${encounter.encounterNumber} started and queued to triage.`,
      encounter: {
        id: encounter.id,
        encounter_number: encounter.encounterNumber,
        current_stage: encounter.currentStage,
        current_status: encounter.currentStatus,
        visit_type: encounter.visitType,
        priority_level: encounter.priorityLevel,
        patient: {
          id: encounter.patient.id,
          patient_number: encounter.patient.patientId,
          full_name: encounter.patient.fullName,
        },
      },
    })
  }

  /** Lean patient projection for the desk review card (PatientCardResource). */
  private patientCard(patient: Patient, activeEncounter: Encounter | null): Record<string, unknown> {
    return {
      id: patient.id,
      patient_number: patient.patientId,
      barcode: patient.barcode,
      full_name: patient.fullName,
      profile_photo_url: this.profilePhotoUrl(patient),
      gender: patient.gender,
      date_of_birth: patient.dateOfBirth?.toISODate() ?? null,
      age: this.age(patient.dateOfBirth),
      nrc_number: patient.nrcNumber,
      phone_number: patient.phoneNumber,
      status: patient.status,
      is_deceased: !!patient.isDeceased,
      eligible: !patient.isDeceased,
      requires_inactive_confirmation: patient.status === 'inactive',
      active_encounter: activeEncounter
        ? {
            id: activeEncounter.id,
            encounter_number: activeEncounter.encounterNumber,
            current_stage: activeEncounter.currentStage,
            current_status: activeEncounter.currentStatus,
            started_at: activeEncounter.startedAt?.toISO() ?? null,
          }
        : null,
    }
  }

  /** Latest open (non-completed) encounter for a patient. */
  private async loadActiveEncounter(patientId: number): Promise<Encounter | null> {
    return Encounter.query()
      .where('patient_id', patientId)
      .whereNot('current_stage', EncounterStage.Completed)
      .orderBy('started_at', 'desc')
      .first()
  }

  /** Map of patientId → latest open encounter, for a batch of patients. */
  private async activeEncounterMap(patientIds: number[]): Promise<Map<number, Encounter>> {
    const map = new Map<number, Encounter>()
    if (patientIds.length === 0) {
      return map
    }

    const encounters = await Encounter.query()
      .whereIn('patient_id', patientIds)
      .whereNot('current_stage', EncounterStage.Completed)
      .orderBy('started_at', 'desc')

    for (const encounter of encounters) {
      if (!map.has(encounter.patientId)) {
        map.set(encounter.patientId, encounter)
      }
    }

    return map
  }

  private async findPortalPatient(ref: string): Promise<Patient | null> {
    return Patient.query()
      .where('patient_id', ref)
      .orWhere('barcode', ref)
      .orWhere('id', /^\d+$/.test(ref) ? Number(ref) : 0)
      .first()
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
}
