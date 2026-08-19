import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import EncounterAudit from '#models/encounter_audit'
import ScreeningRecord from '#models/screening_record'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import ReceiveScreeningReviewQueueAction from '#actions/encounter/receive_screening_review_queue_action'
import RecordScreeningReviewAction from '#actions/encounter/record_screening_review_action'
import SaveScreeningReviewDraftAction from '#actions/encounter/save_screening_review_draft_action'
import RecordScreeningReviewVitalRecheckAction from '#actions/encounter/record_screening_review_vital_recheck_action'
import CreatePrescriptionAction from '#actions/encounter/create_prescription_action'
import QueueEncounterToPharmacyAction from '#actions/encounter/queue_encounter_to_pharmacy_action'
import QueueEncounterBackToLabFromScreeningReviewAction from '#actions/encounter/queue_encounter_back_to_lab_from_screening_review_action'
import QueueEncounterBackToTriageFromScreeningReviewAction from '#actions/encounter/queue_encounter_back_to_triage_from_screening_review_action'
import QueueEncounterToTreatmentRoomFromScreeningReviewAction from '#actions/encounter/queue_encounter_to_treatment_room_from_screening_review_action'
import CloseEncounterFromScreeningReviewAction from '#actions/encounter/close_encounter_from_screening_review_action'
import { closeEncounterValidator } from '#validators/staff/pharmacy'
import {
  screeningReviewValidator,
  screeningReviewDraftValidator,
} from '#validators/staff/screening_review'
import { vitalRecheckValidator, vitalRecheckAutosaveValidator } from '#validators/staff/screening'
import { getReviewScreeningRecord } from '#services/encounter/encounter_records'
import ScreeningVitalRecheck from '#models/screening_vital_recheck'
import {
  isQueuePreviewForStage,
  latestStageTransition,
  paginateCachedStageQueue,
  parseQueuePages,
  screeningReviewQueueRow,
} from '#support/queue/stage_queue_helpers'
import { buildPatientHeaderEncounter, patientHeaderTriage } from '#support/encounter/patient_header_payload'
import { serializeLabItemsWithResults } from '#support/encounter/lab_item_payload'
import { loadClinicalSuggestions } from '#support/clinical/load_clinical_suggestions'
import type User from '#models/user'

/**
 * Screening Review (post-lab clinical review) workbench. Ported from
 * App\Http\Controllers\ScreeningReviewController.
 */
export default class ScreeningReviewController {
  // GET /screening-review/queue
  async queue({ inertia, request, auth }: HttpContext) {
    const { queuedPage, progressPage } = parseQueuePages(request)
    const currentUserId = auth.use('web').user?.id ?? null
    const isQueuePreview = await isQueuePreviewForStage(auth, EncounterStage.ScreeningReview)
    // Shared clinician pool: any non-preview user may open/review any in-progress row.
    const forceManage = !isQueuePreview

    const { queued, inProgress } = await paginateCachedStageQueue({
      stage: EncounterStage.ScreeningReview,
      queuedPage,
      progressPage,
      currentUserId,
      forceManage,
      orderBy: 'lab',
      preload: (query) => {
        query.preload('screeningRecords')
        query.preload('labRequests', (q: any) => {
          q.preload('labRequestItems')
          q.preload('requestedByUser')
          q.preload('labResults', (r: any) => r.preload('recordedByUser'))
        })
        query.preload('pharmacyPrescriptions')
      },
      mapRow: (encounter, inProgress) =>
        screeningReviewQueueRow(encounter, { currentUserId: null, inProgress }),
    })

    return inertia.render('screening-review/queue', {
      isQueuePreview,
      queued,
      inProgress,
    })
  }

  // GET /screening-review/entries
  async entries({ inertia }: HttpContext) {
    const records = await ScreeningRecord.query()
      .preload('patient')
      .preload('encounter')
      .where('screening_type', 'review_after_lab')
      .orderBy('screening_started_at', 'desc')
      .limit(300)

    return inertia.render('screening-review/entries', {
      entries: records.map((r) => ({
        id: r.id,
        reviewed_at:
          r.screeningStartedAt?.toFormat('dd LLL yyyy HH:mm') ??
          r.createdAt?.toFormat('dd LLL yyyy HH:mm') ??
          null,
        encounter_id: r.encounterId,
        encounter_number: r.encounter?.encounterNumber ?? null,
        patient_name: r.patient?.fullName ?? null,
        final_diagnosis: r.finalDiagnosis,
        prescribed: !!r.prescribed,
      })),
    })
  }

  // POST /screening-review/:encounter/receive
  async receive({ params, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')

    if (encounter.isLocked) {
      session.flash('error', 'This encounter is locked and cannot be received.')
      return response.redirect().toPath('/screening-review/queue')
    }
    if (encounter.currentStage !== EncounterStage.ScreeningReview) {
      session.flash('error', 'This encounter is not currently in the Screening Review stage.')
      return response.redirect().toPath('/screening-review/queue')
    }
    if (encounter.currentStatus === EncounterStatus.InProgress) {
      session.flash('success', `Patient ${encounter.patient?.fullName ?? ''} is already in Screening Review.`)
      return response.redirect().toPath(`/screening-review/${encounter.id}`)
    }

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('receiveForStage', encounter, EncounterStage.ScreeningReview)

    try {
      await new ReceiveScreeningReviewQueueAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash(
      'success',
      `Patient ${encounter.patient?.fullName ?? ''} received into Screening Review.`
    )
    return response.redirect().toPath(`/screening-review/${encounter.id}`)
  }

  // GET /screening-review/:encounter
  async show({ params, inertia }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('triageRecords')
    await encounter.load('screeningRecords', (q) =>
      q.preload('screeningVitalRechecks', (rq) => rq.preload('recordedByUser').orderBy('created_at', 'desc'))
    )
    await encounter.load('encounterQueueTransitions', (q) => q.preload('queuedByUser'))
    await encounter.load('labRequests', (q) => {
      q.preload('labRequestItems')
      q.preload('labResults', (r) => {
        r.preload('labRequestItem')
        r.preload('verifiedByUser')
        r.preload('releasedByUser')
      })
    })
    await encounter.load('pharmacyPrescriptions', (q) => q.preload('pharmacyPrescriptionItems'))

    const initial = (encounter.screeningRecords ?? []).find((r) => r.screeningType === 'initial') ?? null
    const review =
      (encounter.screeningRecords ?? [])
        .filter((r) => r.screeningType === 'review_after_lab')
        .sort((a, b) => b.id - a.id)[0] ?? null
    const lr = encounter.labRequests?.[0] ?? null
    const triage = encounter.triageRecords?.[0] ?? null
    const reviewTransition = latestStageTransition(
      encounter.encounterQueueTransitions,
      EncounterStage.ScreeningReview
    )

    const formatDate = (value: DateTime | null | undefined, format = 'dd LLL yyyy, HH:mm') =>
      value?.toFormat(format) ?? null
    const userBadge = (user: User | null | undefined) =>
      user ? { name: user.name, role: null } : null

    const rxDraftAudit = await EncounterAudit.query()
      .where('encounter_id', encounter.id)
      .where('action_name', 'screening_review_rx_draft')
      .orderBy('id', 'desc')
      .first()

    let rxDraft: { items: any[]; prescription_notes: string | null } | null = null
    if (rxDraftAudit?.newValues) {
      try {
        rxDraft = JSON.parse(rxDraftAudit.newValues)
      } catch {
        rxDraft = null
      }
    }

    return inertia.render('screening-review/show', {
      encounter: {
        id: encounter.id,
        status: encounter.currentStatus,
        can_edit:
          encounter.currentStage === EncounterStage.ScreeningReview &&
          encounter.currentStatus === EncounterStatus.InProgress,
        ...(await buildPatientHeaderEncounter(encounter)),
      },
      triage: patientHeaderTriage(triage),
      initialScreening: initial
        ? {
            complaints: initial.complaints,
            provisional_diagnosis: initial.provisionalDiagnosis,
            plan: initial.plan,
            treatment_plan: initial.treatmentPlan,
          }
        : null,
      handover: {
        notes: reviewTransition?.transitionNotes ?? null,
        queued_by_name: reviewTransition?.queuedByUser?.name ?? null,
        queued_at: reviewTransition?.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
      },
      review: review
        ? {
            final_diagnosis: review.finalDiagnosis,
            clinical_findings: review.clinicalFindings,
            physical_examination: review.physicalExamination,
            assessment_notes: review.assessmentNotes,
            plan: review.plan,
            review_notes: review.reviewNotes,
          }
        : null,
      vitalRechecks: (review?.screeningVitalRechecks ?? []).map((rc) => ({
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
      labRequest: lr
        ? {
            request_number: lr.requestNumber,
            status: lr.status,
            priority_level: lr.priorityLevel,
            request_notes: lr.requestNotes,
            items: serializeLabItemsWithResults(lr, { formatDate, userBadge }),
          }
        : null,
      rxDraft,
      clinicalSuggestions: await loadClinicalSuggestions(encounter.id, 'screening_review'),
    })
  }

  // POST /screening-review/:encounter/save-draft  (JSON)
  async saveDraft({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.ScreeningReview)

    const data = await request.validateUsing(screeningReviewDraftValidator)

    try {
      await new SaveScreeningReviewDraftAction().handle(
        encounter,
        {
          final_diagnosis: data.final_diagnosis ?? null,
          clinical_findings: data.clinical_findings ?? null,
          physical_examination: data.physical_examination ?? null,
          assessment_notes: data.assessment_notes ?? null,
          plan: data.plan ?? null,
          review_notes: data.review_notes ?? null,
        },
        user.id
      )

      const rxPayload = {
        items: (data.items ?? []).filter((item) => item.drug_name),
        prescription_notes: data.prescription_notes ?? null,
      }

      const existingAudit = await EncounterAudit.query()
        .where('encounter_id', encounter.id)
        .where('action_name', 'screening_review_rx_draft')
        .orderBy('id', 'desc')
        .first()

      if (existingAudit) {
        existingAudit.newValues = JSON.stringify(rxPayload)
        await existingAudit.save()
      } else {
        await EncounterAudit.create({
          encounterId: encounter.id,
          patientId: encounter.patientId,
          actionName: 'screening_review_rx_draft',
          actionStage: EncounterStage.ScreeningReview,
          actionBy: user.id,
          newValues: JSON.stringify(rxPayload),
          actionAt: DateTime.now(),
        })
      }
    } catch (error) {
      return response.status(409).json({ ok: false, message: error.message })
    }

    return response.json({ ok: true, saved_at: new Date().toISOString() })
  }

  // POST /screening-review/:encounter/vital-recheck
  async saveVitalRecheck({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.ScreeningReview)

    const data = await request.validateUsing(vitalRecheckValidator)

    try {
      await new RecordScreeningReviewVitalRecheckAction().handle(
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

  // POST /screening-review/:encounter/vital-recheck/autosave  (JSON, upsert)
  async autosaveVitalRecheck({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.ScreeningReview)

    const data = await request.validateUsing(vitalRecheckAutosaveValidator)

    const screeningRecord = await getReviewScreeningRecord(encounter.id)
    if (!screeningRecord) {
      return response
        .status(422)
        .json({ ok: false, message: 'Save the clinical review before recording a vital recheck.' })
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

  // POST /screening-review/:encounter/complete
  async complete({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.ScreeningReview)

    const data = await request.validateUsing(screeningReviewValidator)

    try {
      const reviewRecord = await new RecordScreeningReviewAction().handle(
        encounter,
        {
          final_diagnosis: data.final_diagnosis,
          clinical_findings: data.clinical_findings ?? null,
          physical_examination: data.physical_examination ?? null,
          assessment_notes: data.assessment_notes ?? null,
          plan: data.plan ?? null,
          review_notes: data.review_notes ?? null,
        },
        user.id
      )

      await new CreatePrescriptionAction().handle(
        encounter,
        { notes: data.prescription_notes ?? null, items: data.items },
        user.id,
        reviewRecord
      )

      await encounter.refresh()
      await new QueueEncounterToPharmacyAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued to Pharmacy.`)
    return response.redirect().toPath('/screening-review/queue')
  }

  // POST /screening-review/:encounter/queue-lab
  async queueToLab({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.ScreeningReview)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterBackToLabFromScreeningReviewAction().handle(
        encounter,
        user.id,
        notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued back to Lab.`)
    return response.redirect().toPath('/screening-review/queue')
  }

  // POST /screening-review/:encounter/queue-treatment-room
  async queueToTreatmentRoom({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.ScreeningReview)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterToTreatmentRoomFromScreeningReviewAction().handle(
        encounter,
        user.id,
        notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued to Treatment Room.`)
    return response.redirect().toPath('/screening-review/queue')
  }

  // POST /screening-review/:encounter/queue-triage
  async queueToTriage({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.ScreeningReview)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterBackToTriageFromScreeningReviewAction().handle(
        encounter,
        user.id,
        notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} returned to Triage.`)
    return response.redirect().toPath('/screening-review/queue')
  }

  // POST /screening-review/:encounter/close
  async close({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.ScreeningReview)

    if (
      encounter.currentStage !== EncounterStage.ScreeningReview ||
      encounter.currentStatus !== EncounterStatus.InProgress
    ) {
      session.flash('error', 'This encounter is no longer at screening review and cannot be ended here.')
      return response.redirect().toPath(`/screening-review/${encounter.id}`)
    }

    const { closure_notes } = await request.validateUsing(closeEncounterValidator)

    try {
      await new CloseEncounterFromScreeningReviewAction().handle(
        encounter,
        user.id,
        closure_notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} ended at Screening Review.`)
    return response.redirect().toPath('/screening-review/queue')
  }
}
