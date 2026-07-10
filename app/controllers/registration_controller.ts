import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Encounter from '#models/encounter'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus, EncounterStatusHelper } from '#enums/encounter_status'
import StartEncounterAction from '#actions/encounter/start_encounter_action'
import SearchPatientAction from '#actions/encounter/search_patient_action'
import QueueEncounterToTriageAction from '#actions/encounter/queue_encounter_to_triage_action'
import PatientBillingService from '#services/portal/patient_billing_service'
import {
  ActiveEncounterExistsException,
  PatientNotEligibleForEncounterException,
} from '#support/encounter/exceptions'
import { startEncounterValidator } from '#validators/staff/registration'

// Mirrors config/encounter.php (no Adonis config equivalent exists).
const VISIT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Admission', 'Appointment', 'Other']
const PRIORITY_LEVELS: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  emergency: 'Emergency',
}

let villagesCache: { expiresAt: number; names: string[] } | null = null
const VILLAGES_TTL_MS = 5 * 60_000

async function listVillageNames(): Promise<string[]> {
  const now = Date.now()
  if (villagesCache && villagesCache.expiresAt > now) {
    return villagesCache.names
  }

  const villages = await db.from('villages').select('name').orderBy('name')
  const names = villages.map((v) => v.name as string)
  villagesCache = { expiresAt: now + VILLAGES_TTL_MS, names }
  return names
}

/**
 * Registration desk. Ported from App\Http\Controllers\RegistrationController.
 */
export default class RegistrationController {
  // GET /registration
  async index({ inertia, request, authRoleNames }: HttpContext) {
    const roleNames = authRoleNames ?? []
    const isRegistrationClerk = roleNames.includes('registration-clerk')

    const page = Math.max(1, Number(request.qs().page ?? 1))
    const [paginator, villages] = await Promise.all([
      Encounter.query()
        .preload('patient')
        .where('current_stage', EncounterStage.Registration)
        .whereIn('current_status', [EncounterStatus.Started, EncounterStatus.InProgress])
        .orderBy('started_at', 'desc')
        .paginate(page, 15),
      listVillageNames(),
    ])

    const registrationDeskKpis = {
      patientsToday: 0,
      householdsToday: 0,
      activeDeskEncounters: 0,
      queuedToTriageToday: 0,
    }

    if (isRegistrationClerk) {
      const today = DateTime.now().toISODate()!

      const [patientsToday, householdsToday, activeDeskEncounters, queuedToTriageToday] =
        await Promise.all([
          db
            .from('patients')
            .whereRaw('DATE(COALESCE(source_created_at, created_at)) = ?', [today])
            .count('* as total')
            .then((rows) => Number(rows[0]?.total ?? 0)),
          db
            .from('households')
            .whereRaw('DATE(COALESCE(source_created_at, created_at)) = ?', [today])
            .count('* as total')
            .then((rows) => Number(rows[0]?.total ?? 0)),
          db
            .from('encounters')
            .where('current_stage', EncounterStage.Registration)
            .whereIn('current_status', [EncounterStatus.Started, EncounterStatus.InProgress])
            .count('* as total')
            .then((rows) => Number(rows[0]?.total ?? 0)),
          db
            .from('encounters')
            .where('current_stage', EncounterStage.Triage)
            .whereRaw('DATE(updated_at) = ?', [today])
            .count('* as total')
            .then((rows) => Number(rows[0]?.total ?? 0)),
        ])

      registrationDeskKpis.patientsToday = patientsToday
      registrationDeskKpis.householdsToday = householdsToday
      registrationDeskKpis.activeDeskEncounters = activeDeskEncounters
      registrationDeskKpis.queuedToTriageToday = queuedToTriageToday
    }

    const items = paginator.all()

    return inertia.render('registration/index', {
      isRegistrationClerk,
      registrationDeskKpis,
      activeEncounters: {
        data: items.map((e) => ({
          id: e.id,
          encounter_number: e.encounterNumber,
          patient_name: e.patient?.fullName ?? 'Unknown',
          patient_initial: (e.patient?.fullName ?? '?').charAt(0).toUpperCase(),
          visit_type: e.visitType,
          priority_level: e.priorityLevel,
          started_at_relative: e.startedAt?.toRelative() ?? null,
        })),
        meta: {
          current_page: paginator.currentPage,
          last_page: paginator.lastPage,
          per_page: paginator.perPage,
          total: paginator.total,
        },
      },
      villages,
      visitTypes: VISIT_TYPES,
      priorityLevels: Object.entries(PRIORITY_LEVELS).map(([value, label]) => ({ value, label })),
      selectedHouseholdOption: null,
    })
  }

  // GET /registration/search-patient  (JSON)
  async searchPatient({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        q: vine.string().trim().minLength(2).maxLength(100),
        date_of_birth: vine.string().trim().optional().nullable(),
        sex: vine.enum(['male', 'female']).optional().nullable(),
      })
    )
    const { q, date_of_birth, sex } = await request.validateUsing(validator, {
      data: request.qs(),
    })

    const patients = await new SearchPatientAction().handle(q, date_of_birth ?? null, sex ?? null)
    const activeByPatient = await this.activeEncounterMap(patients.map((p) => p.id))

    return response.json({
      patients: patients.map((p) => {
        const active = activeByPatient.get(p.id) ?? null
        return {
          id: p.id,
          patient_id: p.patientId,
          full_name: p.fullName,
          gender: p.gender,
          date_of_birth: p.dateOfBirth?.toISODate() ?? null,
          phone_number: p.phoneNumber,
          nrc_number: p.nrcNumber,
          status: p.status,
          is_deceased: !!p.isDeceased,
          active_encounter: active
            ? {
                id: active.id,
                encounter_number: active.encounterNumber,
                current_stage: active.currentStage,
                stage_label: EncounterStageHelper.label(active.currentStage),
              }
            : null,
        }
      }),
      count: patients.length,
    })
  }

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

  // GET /registration/search-patient/membership  (JSON)
  async searchPatientMembership({ request, response }: HttpContext) {
    const ids = String(request.qs().ids ?? '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, 20)

    const membership = await new PatientBillingService().membershipSummariesForPatientIds(ids)

    return response.json({ membership })
  }

  // GET /registration/search-households  (JSON)
  async searchHouseholds({ request, response }: HttpContext) {
    const q = String(request.qs().q ?? '').trim()
    if (q.length < 1) {
      return response.json({ households: [], count: 0 })
    }
    const like = `%${q}%`

    const households = await db
      .from('households')
      .select('household_id', 'head_of_house')
      .where((builder) => {
        builder.whereILike('head_of_house', like).orWhereILike('household_id', like)
      })
      .orderBy('head_of_house')
      .orderBy('household_id')
      .limit(3)

    return response.json({
      households: households.map((h) => ({
        id: h.household_id,
        name: h.head_of_house || 'Unnamed Household',
        label: `${h.head_of_house || 'Unnamed Household'} (${h.household_id})`,
      })),
      count: households.length,
    })
  }

  // POST /registration/villages  (JSON)
  async addVillage({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        name: vine.string().trim().maxLength(100),
      })
    )
    const { name } = await request.validateUsing(validator)

    const existing = await db.from('villages').where('name', name).first()
    if (existing) {
      return response.status(422).json({ message: 'That village already exists in the list.' })
    }

    await db.table('villages').insert({
      name,
      created_at: new Date(),
      updated_at: new Date(),
    })

    return response.status(201).json({ name })
  }

  // POST /encounters/start
  async start({ request, response, session, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(startEncounterValidator)

    let encounter: Encounter
    try {
      encounter = await new StartEncounterAction().handle(data as Record<string, any>, user.id)
    } catch (error) {
      if (error instanceof ActiveEncounterExistsException) {
        session.flash('error', error.message)
        session.flashAll()
        return response.redirect().back()
      }
      if (error instanceof PatientNotEligibleForEncounterException) {
        session.flash('error', error.message)
        session.flashAll()
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} started.`)
    return response.redirect().toPath(`/registration/encounters/${encounter.id}`)
  }

  // GET /registration/encounters/:encounter
  async showEncounter({ params, inertia, auth, response }: HttpContext) {
    const user = auth.use('web').user ?? null
    const roleNames = user ? await user.getRoleNames() : []
    const isRegistrationClerk = roleNames.includes('registration-clerk')

    const encounter = await Encounter.findOrFail(params.encounter)
    if (isRegistrationClerk && encounter.currentStage !== EncounterStage.Registration) {
      return response.abort('Registration clerks can only view encounters in registration stage.', 403)
    }

    await encounter.load('patient')
    await encounter.load('registrationRecords')
    await encounter.load('triageRecords')
    await encounter.load('screeningRecords')
    await encounter.load('encounterQueueTransitions', (q) => q.preload('queuedByUser'))

    const registration = encounter.registrationRecords?.[0] ?? null
    const canQueueToTriage =
      encounter.currentStage === EncounterStage.Registration &&
      [EncounterStatus.Started, EncounterStatus.InProgress].includes(encounter.currentStatus)

    return inertia.render('registration/encounter', {
      encounter: {
        id: encounter.id,
        encounter_number: encounter.encounterNumber,
        stage: encounter.currentStage,
        stage_label: EncounterStageHelper.label(encounter.currentStage),
        status: encounter.currentStatus,
        status_label: EncounterStatusHelper.label(encounter.currentStatus),
        visit_type: encounter.visitType,
        priority: encounter.priorityLevel,
        started_at: encounter.startedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        patient: encounter.patient
          ? {
              id: encounter.patient.id,
              patient_id: encounter.patient.patientId,
              full_name: encounter.patient.fullName,
              gender: encounter.patient.gender,
              date_of_birth: encounter.patient.dateOfBirth?.toISODate() ?? null,
              phone_number: encounter.patient.phoneNumber,
              nrc_number: encounter.patient.nrcNumber,
            }
          : null,
        registration: registration
          ? {
              was_existing_patient: registration.wasExistingPatient,
              attendant_type: registration.attendantType,
              registration_notes: registration.registrationNotes,
              registered_at: registration.registeredAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
            }
          : null,
        can_queue_to_triage: canQueueToTriage,
        is_queued_to_triage: encounter.currentStage === EncounterStage.Triage,
      },
    })
  }

  // POST /encounters/:encounter/queue/triage
  async queueToTriage({ params, request, response, session, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    const validator = vine.compile(
      vine.object({
        notes: vine.string().trim().maxLength(1000).optional().nullable(),
      })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterToTriageAction().handle(encounter, user.id, notes ?? null)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued to Triage.`)
    return response.redirect().toPath('/registration')
  }
}
