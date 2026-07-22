import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import EncounterQueueTransition from '#models/encounter_queue_transition'
import Bed from '#models/bed'
import Ward from '#models/ward'
import ScreeningRecord from '#models/screening_record'
import ScreeningVitalRecheck from '#models/screening_vital_recheck'
import PharmacyRecommendation from '#models/pharmacy_recommendation'
import TestType from '#models/test_type'
import ReferenceDataCache from '#services/cache/reference_data_cache'
import MedicalDictionaryService from '#services/clinical/medical_dictionary_service'
import { GynObsAlertService } from '#services/gyn_obs/gyn_obs_alert_service'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import ReceiveScreeningQueueAction from '#actions/encounter/receive_screening_queue_action'
import RecordInitialScreeningAction from '#actions/encounter/record_initial_screening_action'
import CreatePrescriptionAction from '#actions/encounter/create_prescription_action'
import CreateLabRequestAction from '#actions/encounter/create_lab_request_action'
import RecordScreeningVitalRecheckAction from '#actions/encounter/record_screening_vital_recheck_action'
import QueueEncounterToLabAction from '#actions/encounter/queue_encounter_to_lab_action'
import QueueEncounterToPharmacyFromScreeningAction from '#actions/encounter/queue_encounter_to_pharmacy_from_screening_action'
import QueueEncounterToTreatmentRoomFromScreeningAction from '#actions/encounter/queue_encounter_to_treatment_room_from_screening_action'
import QueueEncounterBackToTriageAction from '#actions/encounter/queue_encounter_back_to_triage_action'
import GeneratePresumptiveTbCaseNumberAction from '#actions/encounter/generate_presumptive_tb_case_number_action'
import { getInitialScreeningRecord } from '#services/encounter/encounter_records'
import {
  screeningAssessmentValidator,
  clinicianLabRequestValidator,
  vitalRecheckValidator,
  vitalRecheckAutosaveValidator,
} from '#validators/staff/screening'
import {
  applyScreeningCategoryFilter,
  isQueuePreviewForStage,
  paginateScreeningCategoryQueue,
  parseQueuePages,
  screeningQueueRow,
} from '#support/queue/stage_queue_helpers'
import {
  buildPatientHeaderEncounter,
  serializeTriageRecord,
} from '#support/encounter/patient_header_payload'

/**
 * Screening (initial clinical assessment) workbench. Ported from
 * App\Http\Controllers\ScreeningController.
 *
 * NOTE (deferred): the pharmacy-recommendation approve/decline flow in Laravel
 * also copied the recommended drug fields onto the source prescription item; the
 * Lucid PharmacyRecommendation model does not declare the sourceItem/
 * recommendedItem relations, so here only the recommendation status is updated
 * (the substitution field-copy is deferred). Bed admit/discharge tracking omits
 * BedHistory (bed_assignments) rows. Gyn/OBS alert badges on the queue are also
 * deferred.
 */
function expectedWing(gender: string | null | undefined): string | null {
  const g = String(gender ?? '').toLowerCase()
  if (['female', 'f'].includes(g)) return 'Female'
  if (['male', 'm'].includes(g)) return 'Male'
  return null
}

function latestScreeningTransition(
  transitions: EncounterQueueTransition[] | undefined
): EncounterQueueTransition | null {
  if (!transitions?.length) return null

  return (
    [...transitions]
      .filter((transition) => transition.toStage === EncounterStage.Screening)
      .sort((a, b) => {
        const aTime = (a.queuedAt ?? a.createdAt)?.toMillis() ?? 0
        const bTime = (b.queuedAt ?? b.createdAt)?.toMillis() ?? 0
        return bTime - aTime
      })[0] ?? null
  )
}

function parseTbSymptoms(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : [raw]
  } catch {
    return [raw]
  }
}

import { serializePrescriptionItem } from '#support/encounter/prescription_item_payload'
import { loadClinicalSuggestions } from '#support/clinical/load_clinical_suggestions'

function serializeScreeningRecord(sr: ScreeningRecord | null) {
  if (!sr) return null

  return {
    complaints: sr.complaints,
    tb_symptoms: parseTbSymptoms(sr.tbSymptoms),
    constitutional_symptoms: sr.constitutionalSymptoms,
    presumptive_tb_case_no: sr.presumptiveTbCaseNo,
    review_of_systems: sr.reviewOfSystems,
    history_of_presenting_illness: sr.historyOfPresentingIllness,
    past_medical_history: sr.pastMedicalHistory,
    medication_history: sr.medicationHistory,
    allergy_history: sr.allergyHistory,
    chronic_conditions: sr.chronicConditions,
    family_history: sr.familyHistory,
    social_history: sr.socialHistory,
    birth_weight: sr.birthWeight,
    birth_length: sr.birthLength,
    head_circumference: sr.headCircumference,
    chest_circumference: sr.chestCircumference,
    general_condition: sr.generalCondition,
    is_breast_feeding_well: sr.isBreastFeedingWell,
    other_feeding_option: sr.otherFeedingOption,
    delivery_time: sr.deliveryTime,
    vaccination_outside: sr.vaccinationOutside,
    tetanus_at_birth: sr.tetanusAtBirth,
    birth_outcome: sr.birthOutcome,
    birth_notes: sr.birthNotes,
    immunization_history: sr.immunizationHistory,
    feeding_code: sr.feedingCode,
    feeding_comments: sr.feedingComments,
    development_history: sr.developmentHistory,
    physical_examination: sr.physicalExamination,
    clinical_findings: sr.clinicalFindings,
    provisional_diagnosis: sr.provisionalDiagnosis,
    final_diagnosis: sr.finalDiagnosis,
    assessment_notes: sr.assessmentNotes,
    plan: sr.plan,
    treatment_plan: sr.treatmentPlan,
    lab_requested: !!sr.labRequested,
    menstrual_cycle_regularity: sr.menstrualCycleRegularity,
    cycle_length_days: sr.cycleLengthDays,
    duration_of_flow_days: sr.durationOfFlowDays,
    last_menstrual_period: sr.lastMenstrualPeriod?.toISODate() ?? null,
    dysmenorrhoea: sr.dysmenorrhoea,
    intermenstrual_bleeding: sr.intermenstrualBleeding,
    post_coital_bleeding: sr.postCoitalBleeding,
    menstrual_notes: sr.menstrualNotes,
    gravida: sr.gravida,
    para: sr.para,
    abortus: sr.abortus,
    living_children: sr.livingChildren,
    currently_pregnant: sr.currentlyPregnant,
    expected_delivery_date: sr.expectedDeliveryDate?.toISODate() ?? null,
    previous_obstetric_complications: sr.previousObstetricComplications,
    obstetrics_notes: sr.obstetricsNotes,
    using_contraception: sr.usingContraception,
    contraceptive_method: sr.contraceptiveMethod,
    contraceptive_method_other: sr.contraceptiveMethodOther,
    contraceptive_duration_months: sr.contraceptiveDurationMonths,
    previous_contraceptive_methods: sr.previousContraceptiveMethods,
    contraceptive_notes: sr.contraceptiveNotes,
    cervical_screening_done: sr.cervicalScreeningDone,
    cervical_screening_date: sr.cervicalScreeningDate?.toISODate() ?? null,
    cervical_screening_method: sr.cervicalScreeningMethod,
    cervical_screening_result: sr.cervicalScreeningResult,
    cervical_screening_result_notes: sr.cervicalScreeningResultNotes,
    cervical_treatment_done: sr.cervicalTreatmentDone,
    cervical_treatment_type: sr.cervicalTreatmentType,
    cervical_cancer_notes: sr.cervicalCancerNotes,
  }
}

export default class ScreeningController {
  // GET /screening/queue
  async queue({ request, inertia, auth }: HttpContext) {
    const cat = request.qs().cat === 'pediatric' ? 'pediatric' : 'adult'
    const { queuedPage, progressPage } = parseQueuePages(request)
    const currentUserId = auth.use('web').user?.id ?? null
    const isQueuePreview = await isQueuePreviewForStage(auth, EncounterStage.Screening)

    const [adultQueues, pediatricQueues] = await Promise.all([
      paginateScreeningCategoryQueue({
        cat: 'adult',
        queuedPage,
        progressPage,
        currentUserId,
      }),
      paginateScreeningCategoryQueue({
        cat: 'pediatric',
        queuedPage,
        progressPage,
        currentUserId,
      }),
    ])

    return inertia.render('screening/queue', {
      cat,
      isQueuePreview,
      counts: {
        adult: adultQueues.queueTotal,
        pediatric: pediatricQueues.queueTotal,
      },
      queues: {
        adult: {
          queued: adultQueues.queued,
          inProgress: adultQueues.inProgress,
        },
        pediatric: {
          queued: pediatricQueues.queued,
          inProgress: pediatricQueues.inProgress,
        },
      },
    })
  }

  // GET /screening/entries
  async entries({ inertia }: HttpContext) {
    const records = await ScreeningRecord.query()
      .preload('patient')
      .preload('encounter')
      .where('screening_type', 'initial')
      .orderBy('screening_started_at', 'desc')
      .limit(300)

    return inertia.render('screening/entries', {
      entries: records.map((r) => ({
        id: r.id,
        screened_at:
          r.screeningStartedAt?.toFormat('dd LLL yyyy HH:mm') ??
          r.createdAt?.toFormat('dd LLL yyyy HH:mm') ??
          null,
        encounter_id: r.encounterId,
        encounter_number: r.encounter?.encounterNumber ?? null,
        patient_name: r.patient?.fullName ?? null,
        screening_type: r.screeningType,
        diagnosis: r.finalDiagnosis || r.provisionalDiagnosis || null,
        lab_requested: !!r.labRequested,
        prescribed: !!r.prescribed,
      })),
    })
  }

  // GET /screening/presumptive-tb/next-case-number  (JSON)
  async nextPresumptiveTbCaseNumber({ response }: HttpContext) {
    const action = await app.container.make(GeneratePresumptiveTbCaseNumberAction)
    const caseNumber = await action.handle()

    return response.json({ case_number: caseNumber })
  }

  // GET /screening/lab-tests/search  (JSON)
  async searchLabTests({ request, response }: HttpContext) {
    const term = String(request.qs().q ?? '').trim().toLowerCase()
    const limit = Math.min(25, Math.max(5, Number(request.qs().limit ?? 15)))

    const allTestTypes = await ReferenceDataCache.testTypesAll(async () => {
      const rows = await TestType.query().where('isActive', true).preload('labSpecimenType').orderBy('name')
      return rows.map((t) => t.serialize())
    })

    const rows = allTestTypes
      .filter((t) => t.isActive)
      .filter((t) => term === '' || String(t.name).toLowerCase().includes(term))
      .slice(0, limit)

    const defs = await MedicalDictionaryService.definitionsByLabels(
      'lab',
      rows.map((t) => t.name)
    )

    return response.json({
      query: term,
      count: rows.length,
      results: rows.map((t) => {
        const spec = t.labSpecimenType
        return {
          id: t.id,
          name: t.name,
          group: spec?.testCategory ?? t.description,
          specimen: spec ? (spec.defaultUnit ? `${spec.name} · ${spec.defaultUnit}` : spec.name) : null,
          specimen_type_id: t.labSpecimenTypeId,
          definition: defs[t.name] ?? null,
        }
      }),
    })
  }

  // POST /screening/:encounter/receive
  async receive({ params, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('receiveForStage', encounter, EncounterStage.Screening)

    try {
      await new ReceiveScreeningQueueAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Patient ${encounter.patient?.fullName ?? ''} received into Screening.`)
    return response.redirect().toPath(`/screening/${encounter.id}`)
  }

  // GET /screening/:encounter
  async show({ params, inertia, auth, bouncer }: HttpContext) {
    const user = auth.use('web').user ?? null
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('triageRecords')
    await encounter.load('startupMedications', (q) => q.preload('recordedByUser'))
    await encounter.load('screeningRecords', (q) => {
      q.where('screening_type', 'initial').preload('screeningVitalRechecks', (rq) =>
        rq.preload('recordedByUser').orderBy('created_at', 'desc')
      )
    })
    await encounter.load('pharmacyPrescriptions', (q) => {
      q.preload('pharmacyPrescriptionItems')
      q.preload('prescribedByUser')
    })
    await encounter.load('pharmacyRecommendations', (q) => {
      q.preload('recommendedByUser')
      q.preload('sourceItem', (sq) => sq.preload('pharmacyPrescription', (pq) => pq.preload('prescribedByUser')))
      q.preload('recommendedItem')
    })
    await encounter.load('labRequests', (q) => q.preload('labRequestItems'))
    await encounter.load('ward')
    await encounter.load('encounterQueueTransitions', (q) =>
      q.preload('queuedByUser').preload('receivedByUser')
    )

    const sr = encounter.screeningRecords?.[0] ?? null
    const triage = encounter.triageRecords?.[0] ?? null
    const prescription =
      (encounter.pharmacyPrescriptions ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
    const labRequest = encounter.labRequests?.[0] ?? null
    const wing = expectedWing(encounter.patient?.gender)

    const wards = await Ward.query().where('isActive', true).orderBy('name')
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
          .preload('screeningRecords', (q) => q.where('screening_type', 'initial'))
          .preload('startupMedications', (q) => q.preload('recordedByUser'))
          .orderBy('started_at', 'desc')
          .limit(10)
      : []

    const screeningTransition = latestScreeningTransition(encounter.encounterQueueTransitions)
    const fromStage = screeningTransition?.fromStage ?? null
    const isReturnedEncounter =
      !!screeningTransition &&
      fromStage !== null &&
      fromStage !== EncounterStage.Triage &&
      fromStage !== EncounterStage.Registration
    const returnedFromPharmacy = fromStage === EncounterStage.Pharmacy
    const defaultTab = returnedFromPharmacy ? 'prescription' : 'complaints'

    const gynObsAlertService = new GynObsAlertService()
    const gynObsAlerts = sr ? gynObsAlertService.forRecord(sr) : []

    const pendingPharmacyRecommendations = (encounter.pharmacyRecommendations ?? [])
      .filter((r) => ['accepted', 'pending'].includes(r.status))
      .sort((a, b) => b.id - a.id)
      .map((recommendation) => ({
        id: recommendation.id,
        status: recommendation.status,
        note: recommendation.recommendationNote,
        recommended_by: recommendation.recommendedByUser?.name ?? null,
        prescribed_by:
          recommendation.sourceItem?.pharmacyPrescription?.prescribedByUser?.name ?? null,
        source: recommendation.sourceItem ? serializePrescriptionItem(recommendation.sourceItem) : null,
        recommended: recommendation.recommendedItem
          ? serializePrescriptionItem(recommendation.recommendedItem)
          : null,
      }))
      .filter((row) => row.recommended || row.source)

    const canEditInScreening =
      encounter.currentStage === EncounterStage.Screening &&
      encounter.currentStatus === EncounterStatus.InProgress &&
      !encounter.isLocked &&
      user
        ? await (bouncer as any)
            .with('EncounterPolicy')
            .allows('editInStage', encounter, EncounterStage.Screening)
        : false

    const canManageWard =
      user &&
      ((await user.hasPermission('screening.manage-ward-assignment')) ||
        (await user.hasPermission('triage.manage-ward-assignment')))

    return inertia.render('screening/show', {
      canManageWard: !!canManageWard,
      isAtScreening: encounter.currentStage === EncounterStage.Screening,
      isReturnedEncounter,
      returnedFromPharmacy,
      defaultTab,
      returnTransition: screeningTransition
        ? {
            from_stage: screeningTransition.fromStage,
            notes: screeningTransition.transitionNotes,
            queued_by_name: screeningTransition.queuedByUser?.name ?? null,
            queued_at: screeningTransition.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
          }
        : null,
      handover: {
        notes: screeningTransition?.transitionNotes ?? null,
        queued_by_name: screeningTransition?.queuedByUser?.name ?? null,
        queued_at: screeningTransition?.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
      },
      gynObsAlerts,
      pastEncounters: pastEncounters.map((past) => {
        const pastTriage = past.triageRecords?.[0] ?? null
        const pastScreening = past.screeningRecords?.[0] ?? null
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
          screening: pastScreening
            ? {
                complaints: pastScreening.complaints,
                tb_symptoms: parseTbSymptoms(pastScreening.tbSymptoms),
                history_of_presenting_illness: pastScreening.historyOfPresentingIllness,
                provisional_diagnosis: pastScreening.provisionalDiagnosis,
                final_diagnosis: pastScreening.finalDiagnosis,
                plan: pastScreening.plan,
                treatment_plan: pastScreening.treatmentPlan,
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
        can_edit: canEditInScreening,
        ...(await buildPatientHeaderEncounter(encounter)),
      },
      triage: serializeTriageRecord(triage),
      screening: serializeScreeningRecord(sr),
      vitalRechecks: (sr?.screeningVitalRechecks ?? []).map((rc) => ({
        id: rc.id,
        weight: rc.weight,
        height: rc.height,
        bp_systolic: rc.bpSystolic,
        bp_diastolic: rc.bpDiastolic,
        pulse: rc.pulse,
        temperature: rc.temperature,
        spo2: rc.spo2,
        notes: rc.notes,
        recorded_by: rc.recordedByUser?.name ?? null,
        recorded_at: rc.createdAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
      })),
      prescription: prescription
        ? {
            id: prescription.id,
            prescription_number: prescription.prescriptionNumber,
            items: prescription.pharmacyPrescriptionItems.map(serializePrescriptionItem),
          }
        : null,
      pendingPharmacyRecommendations,
      labRequest: labRequest
        ? {
            id: labRequest.id,
            request_number: labRequest.requestNumber,
            priority_level: labRequest.priorityLevel,
            request_notes: labRequest.requestNotes,
            items: labRequest.labRequestItems.map((i) => ({
              id: i.id,
              test_name: i.testName,
              test_group: i.testGroup,
              specimen_type: i.specimenType,
              instructions: i.instructions,
            })),
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
      wards: wards.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        location: w.location,
        wing: w.wing,
      })),
      currentWard: encounter.ward
        ? {
            id: encounter.ward.id,
            name: encounter.ward.name,
            type: encounter.ward.type,
            location: encounter.ward.location,
          }
        : null,
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
            admitted_at: currentBed.admittedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
          }
        : null,
      clinicalSuggestions: await loadClinicalSuggestions(encounter.id, 'screening'),
    })
  }

  private normalizeAssessmentData(data: Record<string, any>): Record<string, any> {
    const normalized = { ...data }

    if (Array.isArray(normalized.tb_symptoms)) {
      normalized.tb_symptoms =
        normalized.tb_symptoms.length > 0 ? JSON.stringify(normalized.tb_symptoms) : null
    }

    return normalized
  }

  private async persistAssessment(
    encounter: Encounter,
    data: Record<string, any>,
    clinicianId: number
  ) {
    let labItems: any[] = []
    if (data.lab_items) {
      try {
        const decoded = JSON.parse(data.lab_items)
        if (Array.isArray(decoded) && decoded.length > 0) {
          labItems = decoded
        }
      } catch {
        labItems = []
      }
    }

    if (labItems.length > 0) {
      data.lab_requested = true
    }

    const screeningRecord = await new RecordInitialScreeningAction().handle(
      encounter,
      data,
      clinicianId
    )

    let prescriptionItems: any[] = []
    if (data.prescriptions) {
      try {
        const decoded = JSON.parse(data.prescriptions)
        if (Array.isArray(decoded) && decoded.length > 0) {
          prescriptionItems = decoded
        }
      } catch {
        prescriptionItems = []
      }
    }

    if (prescriptionItems.length > 0) {
      await new CreatePrescriptionAction().handle(
        encounter,
        { notes: null, items: prescriptionItems },
        clinicianId,
        screeningRecord
      )
    }

    if (labItems.length > 0) {
      const priorityLevel = ['normal', 'urgent', 'stat'].includes(String(data.lab_priority_level ?? ''))
        ? String(data.lab_priority_level)
        : 'normal'

      await new CreateLabRequestAction().handle(
        encounter,
        {
          priority_level: priorityLevel,
          request_notes: data.lab_request_notes ?? null,
          items: labItems.map((item) => ({
            test_name: item.test_name,
            test_code: item.test_code ?? null,
            specimen_type: item.specimen_type ?? null,
            lab_specimen_type_id: item.lab_specimen_type_id ?? null,
            test_group: item.test_group ?? null,
            instructions: item.instructions ?? null,
          })),
        },
        clinicianId
      )
    }
  }

  // POST /screening/:encounter/save-draft  (JSON)
  async saveDraft({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Screening)

    const data = await request.validateUsing(screeningAssessmentValidator)
    const labRequested = !!data.lab_requested

    if (
      encounter.currentStage !== EncounterStage.Screening ||
      encounter.currentStatus !== EncounterStatus.InProgress
    ) {
      return response.json({
        ok: true,
        saved_at: new Date().toISOString(),
        lab_requested: labRequested,
        next_url: labRequested
          ? `/screening/${encounter.id}?tab=lab`
          : `/screening/${encounter.id}`,
      })
    }

    try {
      await this.persistAssessment(
        encounter,
        this.normalizeAssessmentData(data as Record<string, any>),
        user.id
      )
    } catch (error) {
      return response.status(409).json({ ok: false, message: error.message })
    }

    return response.json({
      ok: true,
      saved_at: new Date().toISOString(),
      lab_requested: labRequested,
      next_url: labRequested
        ? `/screening/${encounter.id}?tab=lab`
        : `/screening/${encounter.id}`,
    })
  }

  // POST /screening/:encounter/complete
  async complete({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Screening)

    if (
      encounter.currentStage !== EncounterStage.Screening ||
      encounter.currentStatus !== EncounterStatus.InProgress
    ) {
      session.flash('error', `Encounter ${encounter.encounterNumber} has already been advanced.`)
      return response.redirect().toPath('/screening/queue')
    }

    const data = await request.validateUsing(screeningAssessmentValidator)

    try {
      await this.persistAssessment(
        encounter,
        this.normalizeAssessmentData(data as Record<string, any>),
        user.id
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().toPath('/screening/queue')
    }

    await encounter.refresh()
    const labRequested = !!data.lab_requested

    try {
      if (labRequested) {
        await new QueueEncounterToLabAction().handle(encounter, user.id, data.notes ?? null)
        session.flash('success', `Encounter ${encounter.encounterNumber} queued to Lab.`)
      } else {
        await new QueueEncounterToPharmacyFromScreeningAction().handle(
          encounter,
          user.id,
          data.notes ?? null
        )
        session.flash('success', `Encounter ${encounter.encounterNumber} queued to Pharmacy.`)
      }
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    return response.redirect().toPath('/screening/queue')
  }

  // GET /screening/:encounter/lab-request
  async labRequest({ params, response }: HttpContext) {
    return response.redirect().toPath(`/screening/${params.encounter}?tab=lab`)
  }

  // POST /screening/:encounter/lab-request
  async storeLabRequest({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Screening)

    const data = await request.validateUsing(clinicianLabRequestValidator)

    try {
      await new CreateLabRequestAction().handle(
        encounter,
        {
          priority_level: data.priority_level,
          request_notes: data.request_notes ?? null,
          items: data.items,
        },
        user.id
      )
      await encounter.refresh()
      await new QueueEncounterToLabAction().handle(
        encounter,
        user.id,
        data.notes ?? data.request_notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash(
      'success',
      `Lab request submitted — ${encounter.encounterNumber} queued to Lab.`
    )
    return response.redirect().toPath('/screening/queue')
  }

  // POST /screening/:encounter/lab-request/save-items  (JSON)
  async saveLabItems({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Screening)

    const items = (request.input('items', []) as any[]).filter(
      (i) => i && typeof i === 'object' && i.test_name
    )
    const priorityLevel = String(request.input('priority_level', 'normal'))

    if (items.length === 0) {
      return response.status(422).json({ ok: false, message: 'No valid items provided.' })
    }

    try {
      const labRequest = await new CreateLabRequestAction().handle(
        encounter,
        {
          priority_level: ['normal', 'urgent', 'stat'].includes(priorityLevel)
            ? priorityLevel
            : 'normal',
          request_notes: null,
          items: items.map((i) => ({
            test_name: i.test_name,
            test_code: i.test_code ?? null,
            specimen_type: i.specimen_type ?? null,
            lab_specimen_type_id: i.lab_specimen_type_id ?? null,
            test_group: i.test_group ?? null,
            instructions: i.instructions ?? null,
          })),
        },
        user.id
      )

      return response.json({
        ok: true,
        request_number: labRequest.requestNumber,
        item_count: labRequest.labRequestItems.length,
      })
    } catch (error) {
      return response.status(422).json({ ok: false, message: error.message })
    }
  }

  // POST /screening/:encounter/queue-treatment-room
  async queueToTreatmentRoom({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Screening)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterToTreatmentRoomFromScreeningAction().handle(
        encounter,
        user.id,
        notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued to Treatment Room.`)
    return response.redirect().toPath('/screening/queue')
  }

  // POST /screening/:encounter/queue-triage
  async queueToTriage({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Screening)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterBackToTriageAction().handle(encounter, user.id, notes ?? null)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} returned to Triage.`)
    return response.redirect().toPath('/screening/queue')
  }

  // POST /screening/:encounter/vital-recheck
  async saveVitalRecheck({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Screening)

    const data = await request.validateUsing(vitalRecheckValidator)

    try {
      await new RecordScreeningVitalRecheckAction().handle(
        encounter,
        data as Record<string, any>,
        user.id
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', 'Vital recheck recorded.')
    return response.redirect().back()
  }

  // POST /screening/:encounter/vital-recheck/autosave  (JSON, upsert)
  async autosaveVitalRecheck({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Screening)

    const data = await request.validateUsing(vitalRecheckAutosaveValidator)

    const screeningRecord = await getInitialScreeningRecord(encounter.id)
    if (!screeningRecord) {
      return response
        .status(422)
        .json({ ok: false, message: 'Save the screening assessment before recording a vital recheck.' })
    }

    const fields = {
      weight: data.weight ?? null,
      height: data.height ?? null,
      bpSystolic: data.bp_systolic ?? null,
      bpDiastolic: data.bp_diastolic ?? null,
      pulse: data.pulse ?? null,
      temperature: data.temperature ?? null,
      spo2: data.spo2 ?? null,
      notes: data.notes ?? null,
    }

    const hasValue = Object.values(fields).some((value) => value !== null && value !== '')

    let recheck: ScreeningVitalRecheck | null = null

    if (data.id) {
      recheck = await ScreeningVitalRecheck.query()
        .where('id', data.id)
        .where('encounter_id', encounter.id)
        .first()
    }

    if (!recheck) {
      if (!hasValue) {
        return response.json({ ok: true, recheck: null })
      }
      recheck = await ScreeningVitalRecheck.create({
        screeningRecordId: screeningRecord.id,
        encounterId: encounter.id,
        recordedBy: user.id,
        ...fields,
      })
    } else {
      recheck.merge(fields)
      await recheck.save()
    }

    await recheck.load('recordedByUser')

    return response.json({
      ok: true,
      recheck: {
        id: recheck.id,
        weight: recheck.weight,
        height: recheck.height,
        bp_systolic: recheck.bpSystolic,
        bp_diastolic: recheck.bpDiastolic,
        pulse: recheck.pulse,
        temperature: recheck.temperature,
        spo2: recheck.spo2,
        notes: recheck.notes,
        recorded_by: recheck.recordedByUser?.name ?? null,
        recorded_at: recheck.createdAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
      },
    })
  }

  // POST /screening/:encounter/recommendations/approve-all
  async approveAllRecommendations(ctx: HttpContext) {
    return this.bulkRecommendationDecision(ctx, 'approved')
  }

  // POST /screening/:encounter/recommendations/decline-all
  async declineAllRecommendations(ctx: HttpContext) {
    return this.bulkRecommendationDecision(ctx, 'declined')
  }

  private async bulkRecommendationDecision(
    { params, response, session, auth, bouncer }: HttpContext,
    decision: 'approved' | 'declined'
  ) {
    auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Screening)

    const affected = await PharmacyRecommendation.query()
      .where('encounter_id', encounter.id)
      .whereIn('status', ['accepted', 'pending'])
      .update({ status: decision })

    const count = Array.isArray(affected) ? affected.length : Number(affected)
    if (!count) {
      session.flash('error', 'No pending pharmacy recommendations were found for this encounter.')
    } else {
      session.flash(
        'success',
        `${decision === 'approved' ? 'Approved' : 'Declined'} pharmacy recommendation(s).`
      )
    }
    return response.redirect().toPath(`/screening/${encounter.id}`)
  }

  // POST /screening/:encounter/recommendations/:recommendation/approve
  async approveRecommendation(ctx: HttpContext) {
    return this.singleRecommendationDecision(ctx, 'approved')
  }

  // POST /screening/:encounter/recommendations/:recommendation/decline
  async declineRecommendation(ctx: HttpContext) {
    return this.singleRecommendationDecision(ctx, 'declined')
  }

  private async singleRecommendationDecision(
    { params, response, session, auth, bouncer }: HttpContext,
    decision: 'approved' | 'declined'
  ) {
    auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Screening)

    const recommendation = await PharmacyRecommendation.findOrFail(params.recommendation)
    if (recommendation.encounterId !== encounter.id) {
      return response.notFound('Not found')
    }
    if (!['accepted', 'pending'].includes(recommendation.status)) {
      session.flash('error', 'This recommendation has already been reviewed.')
      return response.redirect().toPath(`/screening/${encounter.id}`)
    }

    recommendation.status = decision
    await recommendation.save()

    session.flash(
      'success',
      `${decision === 'approved' ? 'Approved' : 'Declined'} recommendation.`
    )
    return response.redirect().toPath(`/screening/${encounter.id}`)
  }

  // POST /screening/:encounter/assign-ward  (JSON)
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

  // POST /screening/:encounter/admit  (JSON)
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

  // POST /screening/:encounter/discharge  (JSON)
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
