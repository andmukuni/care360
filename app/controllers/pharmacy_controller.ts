import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import EncounterAudit from '#models/encounter_audit'
import PharmacyPrescription from '#models/pharmacy_prescription'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import ClinicSettings from '#support/clinic_settings'
import EncounterBillingService from '#services/billing/encounter_billing_service'
import ReceivePharmacyQueueAction from '#actions/encounter/receive_pharmacy_queue_action'
import CreatePrescriptionAction from '#actions/encounter/create_prescription_action'
import DispenseMedicationAction from '#actions/encounter/dispense_medication_action'
import AppendPharmacyPrescriptionItemsAction from '#actions/encounter/append_pharmacy_prescription_items_action'
import CloseEncounterAction from '#actions/encounter/close_encounter_action'
import QueueEncounterFromPharmacyToScreeningAction from '#actions/encounter/queue_encounter_from_pharmacy_to_screening_action'
import { serializePrescriptionItem } from '#support/encounter/prescription_item_payload'
import {
  pharmacyPrescriptionValidator,
  dispenseValidator,
  closeEncounterValidator,
  pharmacyDispenseDraftValidator,
} from '#validators/staff/pharmacy'
import {
  closedEncounterRow,
  initialScreeningRecord,
  isRegistrationClerk,
  latestStageTransition,
  paginateCachedClosedEncounters,
  paginateCachedPharmacyQueue,
  parseQueuePages,
  pharmacyQueueRow,
  reviewScreeningRecord,
} from '#support/queue/stage_queue_helpers'
import QueueEncounterToTreatmentRoomAction from '#actions/encounter/queue_encounter_to_treatment_room_action'
import { buildPatientHeaderEncounter, patientHeaderTriage } from '#support/encounter/patient_header_payload'
import { loadClinicalSuggestions } from '#support/clinical/load_clinical_suggestions'

/**
 * Pharmacy workbench. Ported from App\Http\Controllers\PharmacyController.
 *
 * The Laravel prescriptionsDatatable endpoint is collapsed into `prescriptions`
 * returning full ordered rows for the shared client-side DataTable. CloseEncounter
 * is constructed with the EncounterBillingService so the encounter is billed on
 * closure.
 */
export default class PharmacyController {
  private readonly billing = new EncounterBillingService()

  // GET /pharmacy/queue
  async queue({ inertia, request, auth }: HttpContext) {
    const { queuedPage, progressPage, partiallyDispensedPage, closedPage } = parseQueuePages(
      request,
      {
        includeClosed: true,
        includePartiallyDispensed: true,
      }
    )
    const closedSearch = String(request.qs().closed_search ?? '').trim()
    const currentUserId = auth.use('web').user?.id ?? null
    const registrationClerk = await isRegistrationClerk(auth)

    const pharmacyPreload = (query: any) => {
      query.preload('screeningRecords')
      query.preload('pharmacyPrescriptions', (q: any) => {
        q.preload('pharmacyPrescriptionItems')
        q.preload('prescribedByUser')
      })
      query.preload('pharmacyDispenses', (q: any) => {
        q.preload('pharmacyDispenseItems')
      })
    }

    const { queued, inProgress, partiallyDispensed } = await paginateCachedPharmacyQueue({
      queuedPage,
      progressPage,
      partiallyDispensedPage,
      currentUserId,
      preload: pharmacyPreload,
    })

    const closedEncounters = await paginateCachedClosedEncounters({
      closedPage,
      closedSearch,
    })

    return inertia.render('pharmacy/queue', {
      isRegistrationClerk: registrationClerk,
      closedSearch,
      reopenStages: EncounterStageHelper.activeStages().map((stage) => ({
        value: stage,
        label: EncounterStageHelper.label(stage),
      })),
      queued,
      inProgress,
      partiallyDispensed,
      closedEncounters,
    })
  }

  // GET /pharmacy/prescriptions
  async prescriptions({ inertia }: HttpContext) {
    const rows = await PharmacyPrescription.query()
      .preload('patient')
      .preload('encounter')
      .preload('prescribedByUser')
      .withCount('pharmacyPrescriptionItems')
      .orderBy('prescribed_at', 'desc')
      .limit(300)

    return inertia.render('pharmacy/prescriptions', {
      prescriptions: rows.map((rx) => ({
        id: rx.id,
        prescription_number: rx.prescriptionNumber,
        encounter_id: rx.encounterId,
        encounter_number: rx.encounter?.encounterNumber ?? null,
        patient_name: rx.patient?.fullName ?? null,
        items_count: Number(rx.$extras.pharmacyPrescriptionItems_count ?? 0),
        status: rx.status,
        prescribed_at: rx.prescribedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        prescribed_by: rx.prescribedByUser?.name ?? null,
        is_locked: !!rx.encounter?.isLocked,
      })),
    })
  }

  // POST /pharmacy/:encounter/receive
  async receive({ params, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('receiveForStage', encounter, EncounterStage.Pharmacy)

    try {
      await new ReceivePharmacyQueueAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    return response.redirect().toPath(`/pharmacy/${encounter.id}`)
  }

  // GET /pharmacy/:encounter
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
    const dispensedItemIds = new Set<number>()
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
        if (item.pharmacyPrescriptionItemId) {
          dispensedItemIds.add(item.pharmacyPrescriptionItemId)
        }
      }
    }
    const triage = encounter.triageRecords?.[0] ?? null
    const pharmacyTransition = latestStageTransition(
      encounter.encounterQueueTransitions,
      EncounterStage.Pharmacy
    )
    const review = reviewScreeningRecord(encounter)
    const initial = initialScreeningRecord(encounter)

    const dispenseDraftAudit = await EncounterAudit.query()
      .where('encounter_id', encounter.id)
      .where('action_name', 'pharmacy_dispense_draft')
      .orderBy('id', 'desc')
      .first()

    let dispenseDraft: {
      dispensing_notes: string | null
      counseling_notes: string | null
      items: { pharmacy_prescription_item_id: number | null; quantity_dispensed: number | null }[]
    } | null = null

    if (dispenseDraftAudit?.newValues) {
      try {
        dispenseDraft = JSON.parse(dispenseDraftAudit.newValues)
      } catch {
        dispenseDraft = null
      }
    }

    let billingPreview: any = null
    try {
      const preview = await this.billing.preview(encounter)
      const existing = await this.billing.existingInvoice(encounter)
      billingPreview = { ...preview, has_existing_invoice: existing !== null }
    } catch {
      billingPreview = null
    }

    return inertia.render('pharmacy/show', {
      encounter: {
        id: encounter.id,
        status: encounter.currentStatus,
        can_edit:
          encounter.currentStage === EncounterStage.Pharmacy &&
          encounter.currentStatus === EncounterStatus.InProgress,
        ...(await buildPatientHeaderEncounter(encounter)),
      },
      triage: patientHeaderTriage(triage),
      handover: {
        notes: pharmacyTransition?.transitionNotes ?? null,
        queued_by_name:
          pharmacyTransition?.queuedByUser?.name ?? rx?.prescribedByUser?.name ?? null,
        queued_at: pharmacyTransition?.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
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
      prescription: rx
        ? {
            id: rx.id,
            prescription_number: rx.prescriptionNumber,
            status: rx.status,
            notes: rx.notes,
            prescribed_by: rx.prescribedByUser?.name ?? null,
            items: rx.pharmacyPrescriptionItems.map(serializePrescriptionItem),
          }
        : null,
      dispense: allDispensedItems.length
        ? {
            id: latestDispense?.id ?? 0,
            dispensing_notes: latestDispense?.dispensingNotes ?? null,
            counseling_notes: latestDispense?.counselingNotes ?? null,
            items: allDispensedItems,
          }
        : null,
      dispensed_item_ids: [...dispensedItemIds],
      dispenseDraft,
      billingPreview,
      clinicalSuggestions: await loadClinicalSuggestions(encounter.id, 'pharmacy'),
    })
  }

  // GET /pharmacy/:encounter/print
  async printPrescription({ params, inertia, response, auth }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('screeningRecords')
    await encounter.load('pharmacyPrescriptions', (q) => {
      q.preload('pharmacyPrescriptionItems')
      q.preload('prescribedByUser')
    })
    await encounter.load('pharmacyDispenses', (q) => {
      q.preload('pharmacyDispenseItems')
      q.preload('dispensedByUser')
    })

    const rx = (encounter.pharmacyPrescriptions ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
    if (!rx) {
      return response.redirect().toPath(`/pharmacy/${encounter.id}`)
    }

    const dispense =
      (encounter.pharmacyDispenses ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
    const allDispensedItems: {
      drug_name: string
      quantity_dispensed: number
      batch_no: string | null
    }[] = []

    for (const record of encounter.pharmacyDispenses ?? []) {
      for (const item of record.pharmacyDispenseItems ?? []) {
        allDispensedItems.push({
          drug_name: item.drugName,
          quantity_dispensed: item.quantityDispensed,
          batch_no: item.batchNo,
        })
      }
    }

    const review = reviewScreeningRecord(encounter)
    const initial = initialScreeningRecord(encounter)
    const header = await buildPatientHeaderEncounter(encounter)

    const pharmacistUser = dispense?.dispensedByUser ?? auth.getUserOrFail()
    const pharmacist = {
      name: pharmacistUser.name,
      signature_url: pharmacistUser.signaturePath
        ? `/storage/${pharmacistUser.signaturePath}`
        : null,
    }

    return inertia.render('pharmacy/print', {
      facilityName: await ClinicSettings.facilityName(),
      facilityAddress: await ClinicSettings.address(),
      facilityPhone: await ClinicSettings.phone(),
      facilityEmail: await ClinicSettings.email(),
      facilityLogoUrl: await ClinicSettings.logoUrl(),
      encounter: {
        id: encounter.id,
        encounter_number: header.encounter_number,
        started_at: header.started_at,
        patient: header.patient,
      },
      reviewContext: review
        ? {
            final_diagnosis: review.finalDiagnosis,
          }
        : null,
      initialScreening: initial
        ? {
            provisional_diagnosis: initial.provisionalDiagnosis,
          }
        : null,
      prescription: {
        prescription_number: rx.prescriptionNumber,
        status: rx.status,
        notes: rx.notes,
        prescribed_by: rx.prescribedByUser?.name ?? null,
        prescribed_at: (rx.prescribedAt ?? rx.createdAt)?.toISODate() ?? null,
        items: rx.pharmacyPrescriptionItems.map(serializePrescriptionItem),
      },
      pharmacist,
      dispense: allDispensedItems.length
        ? {
            items: allDispensedItems,
          }
        : null,
      printedAt: DateTime.now().toFormat('dd LLL yyyy, HH:mm'),
    })
  }

  // POST /pharmacy/:encounter/save-draft  (JSON)
  async saveDraft({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Pharmacy)

    if (
      encounter.currentStage !== EncounterStage.Pharmacy ||
      encounter.currentStatus !== EncounterStatus.InProgress
    ) {
      return response.json({ ok: true, saved_at: new Date().toISOString() })
    }

    const data = await request.validateUsing(pharmacyDispenseDraftValidator)
    const payload = {
      dispensing_notes: data.dispensing_notes ?? null,
      counseling_notes: data.counseling_notes ?? null,
      items: data.items ?? [],
    }

    try {
      const existingAudit = await EncounterAudit.query()
        .where('encounter_id', encounter.id)
        .where('action_name', 'pharmacy_dispense_draft')
        .orderBy('id', 'desc')
        .first()

      if (existingAudit) {
        existingAudit.newValues = JSON.stringify(payload)
        await existingAudit.save()
      } else {
        await EncounterAudit.create({
          encounterId: encounter.id,
          patientId: encounter.patientId,
          actionName: 'pharmacy_dispense_draft',
          actionStage: EncounterStage.Pharmacy,
          actionBy: user.id,
          newValues: JSON.stringify(payload),
          actionAt: DateTime.now(),
        })
      }
    } catch (error) {
      return response.status(409).json({ ok: false, message: error.message })
    }

    return response.json({ ok: true, saved_at: new Date().toISOString() })
  }

  // POST /pharmacy/:encounter/prescription
  async storePrescription({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Pharmacy)

    const data = await request.validateUsing(pharmacyPrescriptionValidator)

    try {
      await new CreatePrescriptionAction().handle(
        encounter,
        { notes: data.notes ?? null, items: data.items },
        user.id
      )
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', 'Prescription saved.')
    return response.redirect().toPath(`/pharmacy/${encounter.id}`)
  }

  // POST /pharmacy/:encounter/prescription-items
  async appendPrescriptionItems({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Pharmacy)

    const data = await request.validateUsing(pharmacyPrescriptionValidator)

    try {
      await new AppendPharmacyPrescriptionItemsAction().handle(encounter, data.items, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', 'Medication added to prescription.')
    return response.redirect().toPath(`/pharmacy/${encounter.id}`)
  }

  // POST /pharmacy/:encounter/dispense
  async dispense({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Pharmacy)

    const data = await request.validateUsing(dispenseValidator)

    try {
      await new DispenseMedicationAction().handle(encounter, data as Record<string, any>, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', 'Medications dispensed.')
    return response.redirect().toPath(`/pharmacy/${encounter.id}`)
  }

  // POST /pharmacy/:encounter/queue-screening
  async queueBackToScreening({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Pharmacy)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)
    const message =
      notes ?? 'Returned by Pharmacy for screening medication recommendation approval.'

    try {
      await new QueueEncounterFromPharmacyToScreeningAction().handle(encounter, user.id, message)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash(
      'success',
      `Encounter ${encounter.encounterNumber} queued back to Screening for recommendation approval.`
    )
    return response.redirect().toPath('/pharmacy/queue')
  }

  // POST /pharmacy/:encounter/queue-treatment-room
  async queueToTreatmentRoom({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Pharmacy)

    const validator = vine.compile(
      vine.object({ notes: vine.string().trim().maxLength(500).optional().nullable() })
    )
    const { notes } = await request.validateUsing(validator)

    try {
      await new QueueEncounterToTreatmentRoomAction().handle(encounter, user.id, notes ?? null)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} queued to Treatment Room.`)
    return response.redirect().toPath('/pharmacy/queue')
  }

  // POST /pharmacy/:encounter/close
  async close({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Pharmacy)

    const { closure_notes } = await request.validateUsing(closeEncounterValidator)

    try {
      await new CloseEncounterAction(this.billing).handle(encounter, user.id, closure_notes ?? null)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', 'Encounter closed and locked.')
    return response.redirect().toPath(`/pharmacy/${encounter.id}`)
  }
}
