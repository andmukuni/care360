import type { HttpContext } from '@adonisjs/core/http'
import Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import EncounterBillingService from '#services/billing/encounter_billing_service'
import ReceiveTreatmentRoomQueueAction from '#actions/encounter/receive_treatment_room_queue_action'
import CloseEncounterFromTreatmentRoomAction from '#actions/encounter/close_encounter_from_treatment_room_action'
import QueueEncounterToScreeningReviewFromTreatmentRoomAction from '#actions/encounter/queue_encounter_to_screening_review_from_treatment_room_action'
import vine from '@vinejs/vine'
import { serializePrescriptionItem } from '#support/encounter/prescription_item_payload'
import { closeEncounterValidator } from '#validators/staff/pharmacy'
import {
  initialScreeningRecord,
  isQueuePreviewForStage,
  latestStageTransition,
  paginateCachedStageQueue,
  parseQueuePages,
  reviewScreeningRecord,
  treatmentRoomQueueRow,
} from '#support/queue/stage_queue_helpers'
import { buildPatientHeaderEncounter, patientHeaderTriage } from '#support/encounter/patient_header_payload'

/**
 * Treatment Room workbench. Ported from App\Http\Controllers\TreatmentRoomController.
 */
export default class TreatmentRoomController {
  private readonly billing = new EncounterBillingService()

  // GET /treatment-room/queue
  async queue({ inertia, request, auth }: HttpContext) {
    const { queuedPage, progressPage } = parseQueuePages(request)
    const currentUserId = auth.use('web').user?.id ?? null
    const isQueuePreview = await isQueuePreviewForStage(auth, EncounterStage.TreatmentRoom)

    const { queued, inProgress } = await paginateCachedStageQueue({
      stage: EncounterStage.TreatmentRoom,
      queuedPage,
      progressPage,
      currentUserId,
      orderBy: 'clinical',
      preload: (query) => {
        query.preload('pharmacyPrescriptions', (q: any) => q.preload('prescribedByUser'))
        query.preload('pharmacyDispenses', (q: any) =>
          q.preload('pharmacyDispenseItems', (itemQuery: any) =>
            itemQuery.preload('pharmacyPrescriptionItem')
          )
        )
      },
      mapRow: (encounter, inProgress) =>
        treatmentRoomQueueRow(encounter, { currentUserId: null, inProgress }),
    })

    return inertia.render('treatment-room/queue', {
      isQueuePreview,
      queued,
      inProgress,
    })
  }

  // POST /treatment-room/:encounter/receive
  async receive({ params, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('receiveForStage', encounter, EncounterStage.TreatmentRoom)

    try {
      await new ReceiveTreatmentRoomQueueAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    return response.redirect().toPath(`/treatment-room/${encounter.id}`)
  }

  // GET /treatment-room/:encounter
  async show({ params, inertia }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('triageRecords')
    await encounter.load('screeningRecords')
    await encounter.load('encounterQueueTransitions', (q) => q.preload('queuedByUser'))
    await encounter.load('pharmacyPrescriptions', (q) => {
      q.preload('pharmacyPrescriptionItems')
      q.preload('prescribedByUser')
    })
    await encounter.load('pharmacyDispenses', (q) => q.preload('pharmacyDispenseItems'))
    await encounter.load('labRequests', (q) => {
      q.preload('labRequestItems')
      q.preload('labResults', (r) => r.preload('labRequestItem'))
    })

    const rx = (encounter.pharmacyPrescriptions ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
    const latestDispense =
      (encounter.pharmacyDispenses ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
    const triage = encounter.triageRecords?.[0] ?? null
    const review = reviewScreeningRecord(encounter)
    const initial = initialScreeningRecord(encounter)
    const treatmentTransition = latestStageTransition(
      encounter.encounterQueueTransitions,
      EncounterStage.TreatmentRoom
    )

    const allDispensedItems: {
      id: number
      drug_name: string
      quantity_dispensed: number
      batch_no: string | null
    }[] = []

    for (const record of encounter.pharmacyDispenses ?? []) {
      for (const item of record.pharmacyDispenseItems ?? []) {
        allDispensedItems.push({
          id: item.id,
          drug_name: item.drugName,
          quantity_dispensed: item.quantityDispensed,
          batch_no: item.batchNo,
        })
      }
    }

    let billingPreview: any = null
    try {
      const preview = await this.billing.preview(encounter, { includeTreatmentRoomFee: true })
      const existing = await this.billing.existingInvoice(encounter)
      billingPreview = { ...preview, has_existing_invoice: existing !== null }
    } catch {
      billingPreview = null
    }

    return inertia.render('treatment-room/show', {
      encounter: {
        id: encounter.id,
        status: encounter.currentStatus,
        can_edit:
          encounter.currentStage === EncounterStage.TreatmentRoom &&
          encounter.currentStatus === EncounterStatus.InProgress,
        ...(await buildPatientHeaderEncounter(encounter)),
      },
      triage: patientHeaderTriage(triage),
      handover: {
        notes: treatmentTransition?.transitionNotes ?? null,
        queued_by_name: treatmentTransition?.queuedByUser?.name ?? null,
        queued_at: treatmentTransition?.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
      },
      reviewContext: review
        ? {
            final_diagnosis: review.finalDiagnosis,
            assessment_notes: review.assessmentNotes,
            plan: review.plan,
            review_notes: review.reviewNotes,
          }
        : null,
      initialScreening: initial
        ? {
            complaints: initial.complaints,
            provisional_diagnosis: initial.provisionalDiagnosis,
          }
        : null,
      closureNotes: encounter.closureNotes,
      prescription: rx
        ? {
            prescription_number: rx.prescriptionNumber,
            status: rx.status,
            prescribed_by: rx.prescribedByUser?.name ?? null,
            items: rx.pharmacyPrescriptionItems.map(serializePrescriptionItem),
          }
        : null,
      dispense: allDispensedItems.length
        ? {
            id: latestDispense?.id ?? 0,
            items: allDispensedItems,
          }
        : null,
      billingPreview,
    })
  }

  // POST /treatment-room/:encounter/save-draft  (JSON)
  async saveDraft({ params, request, response, auth, bouncer }: HttpContext) {
    auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.TreatmentRoom)

    if (
      encounter.currentStage !== EncounterStage.TreatmentRoom ||
      encounter.currentStatus !== EncounterStatus.InProgress
    ) {
      return response.json({ ok: true, saved_at: new Date().toISOString() })
    }

    const { closure_notes } = await request.validateUsing(closeEncounterValidator)

    try {
      encounter.closureNotes = closure_notes ?? null
      await encounter.save()
    } catch (error) {
      return response.status(409).json({ ok: false, message: error.message })
    }

    return response.json({ ok: true, saved_at: new Date().toISOString() })
  }

  // POST /treatment-room/:encounter/close
  async close({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.TreatmentRoom)

    const { closure_notes } = await request.validateUsing(closeEncounterValidator)

    try {
      await new CloseEncounterFromTreatmentRoomAction(this.billing).handle(
        encounter,
        user.id,
        closure_notes ?? null
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', 'Encounter closed from Treatment Room.')
    return response.redirect().toPath('/treatment-room/queue')
  }

  // POST /treatment-room/:encounter/queue-screening-review
  async queueToScreeningReview({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.TreatmentRoom)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)
    const message =
      notes ?? 'Returned by Treatment Room for screening review.'

    try {
      await new QueueEncounterToScreeningReviewFromTreatmentRoomAction().handle(
        encounter,
        user.id,
        message
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash(
      'success',
      `Encounter ${encounter.encounterNumber} queued to Screening Review.`
    )
    return response.redirect().toPath('/treatment-room/queue')
  }
}
