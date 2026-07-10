import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import EncounterQueueTransition from '#models/encounter_queue_transition'
import Bed from '#models/bed'
import Ward from '#models/ward'
import Medication from '#models/medication'
import StartupMedication from '#models/startup_medication'
import TriageRecord from '#models/triage_record'
import MedicalDictionaryService from '#services/clinical/medical_dictionary_service'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import ReceiveTriageQueueAction from '#actions/encounter/receive_triage_queue_action'
import RecordTriageAction from '#actions/encounter/record_triage_action'
import QueueEncounterToScreeningAction from '#actions/encounter/queue_encounter_to_screening_action'
import { getTriageRecord } from '#services/encounter/encounter_records'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { normalizeTriageVitalsPayload, toDateTime } from '#support/encounter/coerce'
import { buildPatientHeaderEncounter } from '#support/encounter/patient_header_payload'
import { loadClinicalSuggestions } from '#support/clinical/load_clinical_suggestions'
import { triageVitalsValidator, startupMedicationValidator } from '#validators/staff/triage'
import { errors as vineErrors } from '@vinejs/vine'

/**
 * Triage workbench. Ported from App\Http\Controllers\TriageController.
 *
 * NOTE (deferred): the Laravel admit/discharge flow wrote BedHistory rows via a
 * support helper; here the bed + encounter ward fields are updated directly and
 * BedHistory (bed_assignments) tracking is deferred. The startup-medication
 * recommendation notification engine has no Phase-4 equivalent yet, so that
 * side-effect is skipped.
 */
function expectedWing(gender: string | null | undefined): string | null {
  const g = String(gender ?? '').toLowerCase()
  if (['female', 'f'].includes(g)) return 'Female'
  if (['male', 'm'].includes(g)) return 'Male'
  return null
}

function latestTriageTransition(
  transitions: EncounterQueueTransition[] | undefined,
  sortBy: 'queued' | 'received' = 'queued'
): EncounterQueueTransition | null {
  if (!transitions?.length) return null

  return [...transitions]
    .filter((transition) => transition.toStage === EncounterStage.Triage)
    .sort((a, b) => {
      const aTime =
        sortBy === 'received'
          ? (a.receivedAt ?? a.queuedAt ?? a.createdAt)?.toMillis() ?? 0
          : (a.queuedAt ?? a.createdAt)?.toMillis() ?? 0
      const bTime =
        sortBy === 'received'
          ? (b.receivedAt ?? b.queuedAt ?? b.createdAt)?.toMillis() ?? 0
          : (b.queuedAt ?? b.createdAt)?.toMillis() ?? 0
      return bTime - aTime
    })[0] ?? null
}

function queueRow(
  e: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean } = { currentUserId: null }
) {
  const transition = latestTriageTransition(
    e.encounterQueueTransitions,
    options.inProgress ? 'received' : 'queued'
  )
  const receivedById = transition?.receivedBy ?? null
  const canManage =
    !options.inProgress ||
    !receivedById ||
    (options.currentUserId !== null && receivedById === options.currentUserId)
  const triage = e.triageRecords?.[0] ?? null

  return {
    id: e.id,
    encounter_number: e.encounterNumber,
    patient_name: e.patient?.fullName ?? null,
    patient_code: e.patient?.patientId ?? null,
    visit_type: e.visitType,
    priority: e.priorityLevel,
    status: e.currentStatus,
    updated_at_relative: e.updatedAt?.toRelative() ?? null,
    queued_by_name: transition?.queuedByUser?.name ?? 'Unknown user',
    received_by_name: transition?.receivedByUser?.name ?? null,
    has_allergies: Boolean(e.patient?.allergies?.trim()),
    can_manage: canManage,
    temperature: triage?.temperature ?? null,
  }
}

function paginatorPayload<T>(
  paginator: { all: () => Encounter[]; currentPage: number; lastPage: number; perPage: number; total: number },
  mapper: (encounter: Encounter) => T
) {
  return {
    data: paginator.all().map(mapper),
    meta: {
      current_page: paginator.currentPage,
      last_page: paginator.lastPage,
      per_page: paginator.perPage,
      total: paginator.total,
    },
  }
}

async function validateTriageVitalsRequest(request: HttpContext['request']) {
  const normalized = normalizeTriageVitalsPayload(request.all() as Record<string, unknown>)
  return request.validateUsing(triageVitalsValidator, { data: normalized })
}

export default class TriageController {
  // GET /triage/queue
  async queue({ inertia, request, auth }: HttpContext) {
    const user = auth.use('web').user ?? null
    const roleNames = user ? await user.getRoleNames() : []
    const isRegistrationClerk = roleNames.includes('registration-clerk')
    const currentUserId = user?.id ?? null

    const queuedPage = Math.max(1, Number(request.qs().queued_page ?? 1))
    const progressPage = Math.max(1, Number(request.qs().progress_page ?? 1))

    const base = () =>
      Encounter.query()
        .preload('patient')
        .preload('triageRecords', (q) => q.orderBy('id', 'desc'))
        .preload('encounterQueueTransitions', (q) =>
          q.preload('queuedByUser').preload('receivedByUser')
        )
        .where('current_stage', EncounterStage.Triage)

    const queuedPaginator = await Encounter.orderByClinicalPriority(
      base().where('current_status', EncounterStatus.Queued),
      'started_at'
    ).paginate(queuedPage, 20)

    const inProgressPaginator = await Encounter.orderByClinicalPriority(
      base().where('current_status', EncounterStatus.InProgress),
      'started_at'
    ).paginate(progressPage, 20)

    return inertia.render('triage/queue', {
      isRegistrationClerk,
      queued: paginatorPayload(queuedPaginator, (encounter) =>
        queueRow(encounter, { currentUserId })
      ),
      inProgress: paginatorPayload(inProgressPaginator, (encounter) =>
        queueRow(encounter, { currentUserId, inProgress: true })
      ),
    })
  }

  // POST /triage/:encounter/receive
  async receive({ params, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('receiveForStage', encounter, EncounterStage.Triage)

    try {
      await new ReceiveTriageQueueAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Patient ${encounter.patient?.fullName ?? ''} received into triage.`)
    return response.redirect().toPath(`/triage/${encounter.id}`)
  }

  // GET /triage/:encounter
  async show({ params, inertia, auth, bouncer }: HttpContext) {
    const user = auth.use('web').user ?? null
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('triageRecords')
    await encounter.load('startupMedications', (q) => q.preload('recordedByUser'))
    await encounter.load('ward')
    await encounter.load('encounterQueueTransitions', (q) =>
      q.preload('queuedByUser').preload('receivedByUser')
    )
    await encounter.load('encounterStageLogs')

    const triage = encounter.triageRecords?.[0] ?? null
    const wing = expectedWing(encounter.patient?.gender)
    const wardsWithBeds = wing
      ? await Ward.query()
          .where('isActive', true)
          .where('wing', wing)
          .preload('beds', (q) => q.orderBy('bed_number'))
          .orderBy('name')
      : []
    const currentBed = await Bed.query().where('encounter_id', encounter.id).preload('ward').first()

    const pastEncounters = encounter.patientId
      ? await Encounter.query()
          .where('patient_id', encounter.patientId)
          .whereNot('id', encounter.id)
          .preload('triageRecords')
          .preload('startupMedications', (q) => q.preload('recordedByUser'))
          .orderBy('started_at', 'desc')
          .limit(10)
      : []

    const triageTransition = latestTriageTransition(encounter.encounterQueueTransitions, 'queued')
    const openTriageLog = [...(encounter.encounterStageLogs ?? [])]
      .filter((log) => log.stageName === EncounterStage.Triage && !log.completedAt)
      .sort((a, b) => b.id - a.id)[0] ?? null
    const canManageWardInTriage = user
      ? (await user.hasPermission('triage.manage-ward-assignment')) ||
        (await user.hasPermission('screening.manage-ward-assignment'))
      : false

    const canEditInTriage =
      encounter.currentStage === EncounterStage.Triage &&
      encounter.currentStatus === EncounterStatus.InProgress &&
      !encounter.isLocked &&
      user
        ? await (bouncer as any)
            .with('EncounterPolicy')
            .allows('editInStage', encounter, EncounterStage.Triage)
        : false

    return inertia.render('triage/show', {
      canManageWardInTriage,
      isAtTriage: encounter.currentStage === EncounterStage.Triage,
      handover: {
        notes: triageTransition?.transitionNotes ?? null,
        queued_by_name: triageTransition?.queuedByUser?.name ?? null,
        queued_at: triageTransition?.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
      },
      draftHandoverNotes: openTriageLog?.notes ?? null,
      pastEncounters: pastEncounters.map((past) => {
        const pastTriage = past.triageRecords?.[0] ?? null
        return {
          id: past.id,
          encounter_number: past.encounterNumber,
          visit_type: past.visitType,
          priority: past.priorityLevel,
          started_at: past.startedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
          triage: pastTriage
            ? {
                weight: pastTriage.weight,
                height: pastTriage.height,
                bmi: pastTriage.bmi,
                temperature: pastTriage.temperature,
                pulse: pastTriage.pulse,
                respiratory_rate: pastTriage.respiratoryRate,
                systolic_bp: pastTriage.systolicBp,
                diastolic_bp: pastTriage.diastolicBp,
                oxygen_saturation: pastTriage.oxygenSaturation,
                blood_sugar: pastTriage.bloodSugar,
                muac: pastTriage.muac,
                muac_score: pastTriage.muacScore,
                abdominal_circumference: pastTriage.abdominalCircumference,
                chief_complaint_brief: pastTriage.chiefComplaintBrief,
                startup_interventions_notes: pastTriage.startupInterventionsNotes,
              }
            : null,
          startup_medications: (past.startupMedications ?? []).map((m) => ({
            id: m.id,
            medication_name: m.medicationName,
            dosage: m.dosage,
            route: m.route,
            frequency: m.frequency,
            administered_at: m.administeredAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
            recorded_by: m.recordedByUser?.name ?? null,
            status: m.status,
          })),
        }
      }),
      encounter: {
        id: encounter.id,
        status: encounter.currentStatus,
        can_edit: canEditInTriage,
        ...(await buildPatientHeaderEncounter(encounter)),
      },
      triage: triage
        ? {
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
            muac: triage.muac,
            muac_score: triage.muacScore,
            abdominal_circumference: triage.abdominalCircumference,
            chief_complaint_brief: triage.chiefComplaintBrief,
            startup_interventions_notes: triage.startupInterventionsNotes,
            triage_notes: triage.triageNotes,
          }
        : null,
      startupMedications: (encounter.startupMedications ?? []).map((m) => ({
        id: m.id,
        medication_name: m.medicationName,
        dosage: m.dosage,
        route: m.route,
        frequency: m.frequency,
        notes: m.notes,
        source: m.source,
        status: m.status,
        administered_at: m.administeredAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        recorded_by: m.recordedByUser?.name ?? null,
      })),
      targetWing: wing,
      wardsWithBeds: wardsWithBeds.map((w) => ({
        id: w.id,
        name: w.name,
        wing: w.wing,
        beds: w.beds.map((b) => ({
          id: b.id,
          bed_number: b.bedNumber,
          status: b.status,
          encounter_id: b.encounterId,
          patient_name: b.patientName,
        })),
      })),
      currentBed: currentBed
        ? {
            id: currentBed.id,
            bed_number: currentBed.bedNumber,
            ward_name: currentBed.ward?.name ?? null,
            wing: currentBed.ward?.wing ?? null,
            admitted_at: currentBed.admittedAt?.toFormat('dd MMM yyyy HH:mm') ?? null,
          }
        : null,
      clinicalSuggestions: await loadClinicalSuggestions(encounter.id, 'triage'),
    })
  }

  // POST /triage/:encounter/save-vitals
  async saveVitals({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    const wantsJson =
      request.header('accept')?.includes('application/json') ||
      request.header('content-type')?.includes('application/json')

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Triage)

    if (encounter.currentStage !== EncounterStage.Triage) {
      if (wantsJson) {
        return response.json({ ok: true, saved_at: new Date().toISOString() })
      }
      session.flash('error', 'This encounter is no longer at the triage stage.')
      return response.redirect().toPath(`/triage/${encounter.id}`)
    }

    let data
    try {
      data = await validateTriageVitalsRequest(request)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        const firstMessage = error.messages[0]?.message ?? 'Validation failed'
        if (wantsJson) {
          return response.status(422).json({
            ok: false,
            message: firstMessage,
            errors: error.messages,
          })
        }
        session.flash('error', firstMessage)
        return response.redirect().back()
      }
      throw error
    }

    try {
      await new RecordTriageAction().handle(encounter, data as Record<string, any>, user.id)
      await new EncounterWorkflowService().updateOpenStageLogNotes(
        encounter,
        (data.notes as string | null | undefined) ?? null
      )
    } catch (error) {
      if (wantsJson) {
        return response.status(409).json({ ok: false, message: error.message })
      }
      session.flash('error', error.message)
      return response.redirect().back()
    }

    if (wantsJson) {
      return response.json({ ok: true, saved_at: new Date().toISOString() })
    }

    session.flash('success', 'Vitals saved successfully.')
    return response.redirect().toPath(`/triage/${encounter.id}`)
  }

  // POST /triage/:encounter/complete
  async complete({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Triage)

    if (encounter.currentStage !== EncounterStage.Triage) {
      session.flash('error', 'This encounter is no longer at the triage stage and cannot be completed.')
      return response.redirect().toPath(`/triage/${encounter.id}`)
    }

    let data
    try {
      data = await validateTriageVitalsRequest(request)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        session.flash('error', error.messages[0]?.message ?? 'Validation failed')
        return response.redirect().back()
      }
      throw error
    }

    try {
      await new RecordTriageAction().handle(encounter, data as Record<string, any>, user.id)
      await new QueueEncounterToScreeningAction().handle(encounter, user.id, data.notes ?? null)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued to Screening.`)
    return response.redirect().toPath('/triage/queue')
  }

  // GET /triage/vitals
  async vitals({ request, inertia }: HttpContext) {
    const search = String(request.qs().search ?? '').trim()

    const records = await TriageRecord.query()
      .preload('patient')
      .preload('encounter')
      .if(search !== '', (q) =>
        q.whereHas('patient', (p) => p.whereILike('full_name', `%${search}%`))
      )
      .orderBy('triage_at', 'desc')
      .limit(300)

    return inertia.render('triage/vitals', {
      records: records.map((r) => ({
        id: r.id,
        triage_at: r.triageAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        patient_name: r.patient?.fullName ?? null,
        encounter_number: r.encounter?.encounterNumber ?? null,
        weight: r.weight,
        height: r.height,
        bmi: r.bmi,
        temperature: r.temperature,
        pulse: r.pulse,
        systolic_bp: r.systolicBp,
        diastolic_bp: r.diastolicBp,
      })),
      search,
    })
  }

  // GET /triage/startup-medications
  async startupMedications({ request, inertia }: HttpContext) {
    const search = String(request.qs().search ?? '').trim()

    const medications = await StartupMedication.query()
      .preload('patient')
      .preload('encounter')
      .preload('recordedByUser')
      .if(search !== '', (q) =>
        q
          .whereILike('medication_name', `%${search}%`)
          .orWhereHas('patient', (p) => p.whereILike('full_name', `%${search}%`))
      )
      .orderBy('created_at', 'desc')
      .limit(300)

    return inertia.render('triage/startup-medications', {
      medications: medications.map((m) => ({
        id: m.id,
        medication_name: m.medicationName,
        dosage: m.dosage,
        route: m.route,
        frequency: m.frequency,
        source: m.source,
        status: m.status,
        patient_name: m.patient?.fullName ?? null,
        encounter_number: m.encounter?.encounterNumber ?? null,
        recorded_by: m.recordedByUser?.name ?? null,
        created_at: m.createdAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
      })),
      search,
    })
  }

  // POST /triage/:encounter/startup-medications
  async storeStartupMedication({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Triage)

    const data = await request.validateUsing(startupMedicationValidator)
    const triage = await getTriageRecord(encounter.id)

    const med = await encounter.related('startupMedications').create({
      triageRecordId: triage?.id ?? null,
      patientId: encounter.patientId,
      recordedBy: user.id,
      medicationId: data.medication_id ?? null,
      medicationName: data.medication_name,
      dosage: data.dosage ?? null,
      route: data.route ?? null,
      frequency: data.frequency ?? null,
      notes: data.notes ?? null,
      administeredAt: toDateTime(data.administered_at ?? null),
      source: 'triage',
      status: 'active',
    })

    await med.load('recordedByUser')
    const countRows = await StartupMedication.query()
      .where('encounter_id', encounter.id)
      .where('status', 'active')
      .count('* as total')

    return response.json({
      success: true,
      med: {
        id: med.id,
        medication_name: med.medicationName,
        dosage: med.dosage,
        route: med.route,
        frequency: med.frequency,
        notes: med.notes,
        administered_at: med.administeredAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        recorded_by: med.recordedByUser?.name ?? null,
        source: med.source,
        status: med.status,
      },
      count: Number((countRows[0] as any)?.$extras?.total ?? 0),
    })
  }

  // POST /triage/:encounter/startup-medications/recommend
  async recommendStartupMedication({
    params,
    request,
    response,
    session,
    auth,
    bouncer,
  }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    const expectedStage =
      encounter.currentStage === EncounterStage.Screening
        ? EncounterStage.Screening
        : EncounterStage.Triage
    await (bouncer as any).with('EncounterPolicy').authorize('editInStage', encounter, expectedStage)

    const data = await request.validateUsing(startupMedicationValidator)

    // Discontinue currently active triage-sourced medications.
    await StartupMedication.query()
      .where('encounter_id', encounter.id)
      .where('status', 'active')
      .where('source', 'triage')
      .update({
        status: 'discontinued',
        discontinued_at: DateTime.now().toSQL(),
        discontinued_by: user.id,
        discontinued_reason: 'Replaced by screening recommendation',
      })

    const triage = await getTriageRecord(encounter.id)

    await encounter.related('startupMedications').create({
      triageRecordId: triage?.id ?? null,
      patientId: encounter.patientId,
      recordedBy: user.id,
      medicationId: data.medication_id ?? null,
      medicationName: data.medication_name,
      dosage: data.dosage ?? null,
      route: data.route ?? null,
      frequency: data.frequency ?? null,
      notes: data.notes ?? null,
      administeredAt: toDateTime(data.administered_at ?? null),
      source: 'screening',
      status: 'active',
    })

    session.flash('success', 'Medication recommended — triage medications discontinued.')
    return response.redirect().toPath(`/screening/${encounter.id}`)
  }

  // DELETE /triage/startup-medications/:medication
  async destroyStartupMedication({ params, request, response, session, auth, bouncer }: HttpContext) {
    auth.getUserOrFail()
    const medication = await StartupMedication.findOrFail(params.medication)
    const encounter = await Encounter.findOrFail(medication.encounterId)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Triage)

    await medication.delete()

    const count = await StartupMedication.query()
      .where('encounter_id', encounter.id)
      .where('status', 'active')
      .count('* as total')

    return response.json({
      success: true,
      count: Number((count[0] as any)?.$extras?.total ?? 0),
    })
  }

  // GET /medications/search  (JSON)
  async searchMedications({ request, response }: HttpContext) {
    const q = String(request.qs().q ?? '').trim()

    const results = await Medication.query()
      .where('isActive', true)
      .preload('units', (unitQuery) => unitQuery.select('id', 'name', 'form', 'strength'))
      .if(q !== '', (query) =>
        query.where((sub) => {
          sub
            .whereILike('name', `%${q}%`)
            .orWhereILike('generic_name', `%${q}%`)
            .orWhereHas('units', (unitSub) => unitSub.whereILike('name', `%${q}%`))
        })
      )
      .orderBy('name')
      .limit(20)

    const defs = await MedicalDictionaryService.definitionsByLabels(
      'drug',
      results.flatMap((m) => [m.name, m.genericName ?? ''].filter(Boolean))
    )

    return response.json(
      results.map((m) => {
        const primaryUnit = m.units[0]

        return {
          id: m.id,
          name: m.name,
          generic_name: m.genericName,
          strength: primaryUnit?.strength ?? m.strength,
          form: primaryUnit?.form ?? m.form,
          category: m.category,
          default_route: m.defaultRoute,
          default_frequency: m.defaultFrequency,
          stock_on_hand: m.stockOnHand,
          units: m.units.map((u) => u.name),
          unit_details: m.units.map((u) => ({
            name: u.name,
            form: u.form,
            strength: u.strength,
          })),
          definition: defs[m.name] ?? (m.genericName ? defs[m.genericName] : null) ?? null,
        }
      })
    )
  }

  // POST /triage/:encounter/assign-ward  (JSON)
  async assignWard({ params, request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    const validator = vine.compile(vine.object({ ward_id: vine.number().optional().nullable() }))
    const { ward_id } = await request.validateUsing(validator)

    encounter.wardId = ward_id ?? null
    encounter.wardAssignedAt = ward_id ? DateTime.now() : null
    encounter.wardAssignedBy = ward_id ? user.id : null
    await encounter.save()
    await encounter.load('ward')

    return response.json({
      ok: true,
      ward: encounter.ward
        ? { id: encounter.ward.id, name: encounter.ward.name, type: encounter.ward.type }
        : null,
    })
  }

  // POST /triage/:encounter/admit  (JSON)
  async admitToWard({ params, request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')

    const validator = vine.compile(vine.object({ bed_id: vine.number() }))
    const { bed_id } = await request.validateUsing(validator)

    const bed = await Bed.query().where('id', bed_id).preload('ward').first()
    if (!bed) {
      return response.status(422).json({ ok: false, message: 'Bed not found.' })
    }
    if (bed.status === 'occupied' && bed.encounterId !== encounter.id) {
      return response.status(422).json({ ok: false, message: 'That bed is already occupied.' })
    }

    const wing = expectedWing(encounter.patient?.gender)
    if (!wing) {
      return response
        .status(422)
        .json({ ok: false, message: 'Patient gender is not set; cannot determine ward.' })
    }
    if (bed.ward?.wing !== wing) {
      return response
        .status(422)
        .json({ ok: false, message: 'Bed wing does not match patient gender.' })
    }

    await db.transaction(async (trx) => {
      await Bed.query({ client: trx })
        .where('encounter_id', encounter.id)
        .whereNot('id', bed.id)
        .update({
          status: 'available',
          encounter_id: null,
          patient_name: null,
          admitted_at: null,
          discharged_at: DateTime.now().toSQL(),
        })

      bed.useTransaction(trx)
      bed.status = 'occupied'
      bed.encounterId = encounter.id
      bed.patientName = encounter.patient?.fullName ?? null
      bed.admittedAt = DateTime.now()
      bed.dischargedAt = null
      await bed.save()

      encounter.useTransaction(trx)
      encounter.wardId = bed.wardId
      encounter.wardAssignedAt = DateTime.now()
      encounter.wardAssignedBy = user.id
      await encounter.save()
    })

    await bed.load('ward')
    return response.json({
      ok: true,
      bed: {
        id: bed.id,
        bed_number: bed.bedNumber,
        ward_name: bed.ward?.name ?? null,
        wing: bed.ward?.wing ?? null,
        admitted_at: bed.admittedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
      },
    })
  }

  // POST /triage/:encounter/discharge  (JSON)
  async discharge({ params, response, auth }: HttpContext) {
    auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    const bed = await Bed.query().where('encounter_id', encounter.id).first()
    if (!bed) {
      return response
        .status(422)
        .json({ ok: false, message: 'Patient is not currently admitted.' })
    }

    await db.transaction(async (trx) => {
      bed.useTransaction(trx)
      bed.status = 'available'
      bed.encounterId = null
      bed.patientName = null
      bed.admittedAt = null
      bed.dischargedAt = DateTime.now()
      await bed.save()

      encounter.useTransaction(trx)
      encounter.wardId = null
      encounter.wardAssignedAt = null
      encounter.wardAssignedBy = null
      await encounter.save()
    })

    return response.json({ ok: true, message: 'Patient discharged.' })
  }
}
