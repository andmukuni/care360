import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import LabRequest from '#models/lab_request'
import LabResult from '#models/lab_result'
import LabTestCatalog from '#models/lab_test_catalog'
import LabSpecimenType from '#models/lab_specimen_type'
import TestType from '#models/test_type'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import ClinicSettings from '#support/clinic_settings'
import ReceiveLabQueueAction from '#actions/encounter/receive_lab_queue_action'
import RecordLabSamplesAction from '#actions/encounter/record_lab_samples_action'
import RecordLabResultsAction from '#actions/encounter/record_lab_results_action'
import QueueEncounterBackToScreeningAction from '#actions/encounter/queue_encounter_back_to_screening_action'
import { getLabRequest } from '#services/encounter/encounter_records'
import {
  labSamplesValidator,
  labResultsValidator,
  labResultUpdateValidator,
  labResultMetaValidator,
  labCompleteValidator,
} from '#validators/staff/lab'
import {
  isQueuePreviewForStage,
  labQueueRow,
  latestStageTransition,
  paginateCachedStageQueue,
  parseQueuePages,
} from '#support/queue/stage_queue_helpers'
import { buildPatientHeaderEncounter, patientHeaderTriage } from '#support/encounter/patient_header_payload'
import { serializeLabItemsWithResults } from '#support/encounter/lab_item_payload'
import {
  initialScreeningRecord,
  reviewScreeningRecord,
} from '#support/queue/stage_queue_helpers'
import {
  buildLabResultFormMaps,
  deriveFormKey,
  resolveRenderType,
} from '#support/lab/lab_result_form_maps'

/**
 * Laboratory workbench. Ported from App\Http\Controllers\LabController.
 *
 * The Laravel DataTables endpoints (entriesDatatable, testResultsDatatable) are
 * collapsed into entries/testResults returning full ordered rows for the shared
 * client-side DataTable.
 */
export default class LabController {
  private wantsJson(request: HttpContext['request']): boolean {
    if (request.header('x-inertia')) {
      return false
    }

    const accept = request.header('accept') ?? ''
    return accept.includes('application/json') && !accept.includes('text/html')
  }

  // GET /lab/queue
  async queue({ inertia, request, auth }: HttpContext) {
    const { queuedPage, progressPage } = parseQueuePages(request)
    const currentUserId = auth.use('web').user?.id ?? null
    const isQueuePreview = await isQueuePreviewForStage(auth, EncounterStage.Lab)

    const { queued, inProgress } = await paginateCachedStageQueue({
      stage: EncounterStage.Lab,
      queuedPage,
      progressPage,
      currentUserId,
      orderBy: 'lab',
      preload: (query) => {
        query.preload('labRequests', (q: any) => q.preload('labRequestItems'))
      },
      mapRow: (encounter, inProgress) =>
        labQueueRow(encounter, { currentUserId: null, inProgress }),
    })

    return inertia.render('lab/queue', {
      isQueuePreview,
      queued,
      inProgress,
    })
  }

  // GET /lab/entries
  async entries({ inertia }: HttpContext) {
    const requests = await LabRequest.query()
      .preload('patient')
      .preload('encounter')
      .preload('labRequestItems')
      .preload('labResults')
      .orderBy('requested_at', 'desc')
      .limit(300)

    return inertia.render('lab/entries', {
      entries: requests.map((lr) => ({
        id: lr.id,
        requested_at: lr.requestedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        request_number: lr.requestNumber,
        encounter_id: lr.encounterId,
        encounter_number: lr.encounter?.encounterNumber ?? null,
        patient_name: lr.patient?.fullName ?? null,
        priority_level: lr.priorityLevel,
        status: lr.status,
        test_count: lr.labRequestItems.length,
        result_count: lr.labResults.length,
      })),
    })
  }

  // GET /lab/test-results
  async testResults({ inertia }: HttpContext) {
    const results = await LabResult.query()
      .preload('patient')
      .preload('encounter')
      .preload('recordedByUser')
      .preload('labRequestItem')
      .orderBy('result_recorded_at', 'desc')
      .limit(300)

    return inertia.render('lab/test-results', {
      results: results.map((r) => ({
        id: r.id,
        recorded_at: r.resultRecordedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
        encounter_id: r.encounterId,
        encounter_number: r.encounter?.encounterNumber ?? null,
        patient_name: r.patient?.fullName ?? null,
        test_name: r.labRequestItem?.testName ?? null,
        result_value: r.resultValue || r.resultText,
        interpretation: r.interpretation,
        result_status: r.resultStatus,
        recorded_by: r.recordedByUser?.name ?? null,
      })),
    })
  }

  // GET /lab/form-mappings
  async formMappings({ inertia }: HttpContext) {
    const catalog = await LabTestCatalog.query()
      .preload('labResultForm')
      .where('is_active', true)
      .orderBy('group')
      .orderBy('name')

    const rows = catalog.map((t) => ({
      name: t.name,
      group: t.group ?? '—',
      specimen: t.specimen ?? '—',
      form_key: t.labResultForm?.key ?? 'quantitative',
      form_label: t.labResultForm?.label ?? 'Quantitative',
    }))

    const counts: Record<string, number> = {}
    for (const r of rows) {
      counts[r.form_key] = (counts[r.form_key] ?? 0) + 1
    }

    return inertia.render('lab/form-mappings', { rows, counts })
  }

  // POST /lab/:encounter/receive
  async receive({ params, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('receiveForStage', encounter, EncounterStage.Lab)

    try {
      await new ReceiveLabQueueAction().handle(encounter, user.id)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Patient ${encounter.patient?.fullName ?? ''} received into Lab.`)
    return response.redirect().toPath(`/lab/${encounter.id}`)
  }

  // GET /lab/:encounter
  async show({ params, inertia }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('triageRecords')
    await encounter.load('screeningRecords', (q) => q.where('screening_type', 'initial'))
    await encounter.load('encounterQueueTransitions', (q) => q.preload('queuedByUser'))
    await encounter.load('labRequests', (q) => {
      q.preload('labRequestItems')
      q.preload('labSamples')
      q.preload('labResults', (r) => r.preload('recordedByUser'))
    })

    const lr = encounter.labRequests?.[0] ?? null
    const sr = encounter.screeningRecords?.[0] ?? null
    const triage = encounter.triageRecords?.[0] ?? null
    const labTransition = latestStageTransition(encounter.encounterQueueTransitions, EncounterStage.Lab)

    const [specimenCatalog, labResultForms] = await Promise.all([
      LabSpecimenType.query()
        .where('is_active', true)
        .orderBy('test_category')
        .orderBy('sort_order')
        .orderBy('name'),
      buildLabResultFormMaps(),
    ])

    return inertia.render('lab/show', {
      encounter: {
        id: encounter.id,
        status: encounter.currentStatus,
        can_edit:
          encounter.currentStage === EncounterStage.Lab &&
          encounter.currentStatus === EncounterStatus.InProgress,
        ...(await buildPatientHeaderEncounter(encounter)),
      },
      triage: patientHeaderTriage(triage),
      handover: {
        notes: labTransition?.transitionNotes ?? null,
        queued_by_name: labTransition?.queuedByUser?.name ?? null,
        queued_at: labTransition?.queuedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
      },
      screening: sr
        ? {
            complaints: sr.complaints,
            provisional_diagnosis: sr.provisionalDiagnosis,
            plan: sr.plan,
            treatment_plan: sr.treatmentPlan,
          }
        : null,
      labRequest: lr
        ? {
            id: lr.id,
            request_number: lr.requestNumber,
            priority_level: lr.priorityLevel,
            status: lr.status,
            request_notes: lr.requestNotes,
            items: lr.labRequestItems.map((i) => {
              const result = lr.labResults.find((r) => r.labRequestItemId === i.id) ?? null
              const formKey = deriveFormKey(i.testName, labResultForms.testFormKeyMap)
              const formType = resolveRenderType(formKey, labResultForms.formRenderMap)
              return {
                id: i.id,
                test_name: i.testName,
                specimen_type: i.specimenType,
                test_group: i.testGroup,
                instructions: i.instructions,
                status: i.status,
                form_key: formKey,
                form_type: formType,
                form_label: labResultForms.formLabelMap[formKey] ?? null,
                result: result
                  ? {
                      id: result.id,
                      result_value: result.resultValue,
                      result_text: result.resultText,
                      reference_range: result.referenceRange,
                      interpretation: result.interpretation,
                      remarks: result.remarks,
                    }
                  : null,
              }
            }),
            samples: lr.labSamples.map((s) => ({
              id: s.id,
              sample_type: s.sampleType,
              sample_label: s.sampleLabel,
              collected_at: s.collectedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
            })),
          }
        : null,
      labResultForms,
      specimenCatalog: specimenCatalog.map((s) => ({
        id: s.id,
        label: s.defaultUnit ? `${s.name} (${s.defaultUnit})` : s.name,
        name: s.name,
        category: s.testCategory,
      })),
    })
  }

  // GET /lab/:encounter/print
  async printResults({ params, inertia, response, auth }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('patient')
    await encounter.load('screeningRecords')
    await encounter.load('labRequests', (q) => {
      q.preload('labRequestItems')
      q.preload('requestedByUser')
      q.preload('labResults', (r) => {
        r.preload('recordedByUser')
        r.preload('verifiedByUser')
      })
    })

    const lr = encounter.labRequests?.[0] ?? null
    if (!lr) {
      return response.redirect().toPath(`/lab/${encounter.id}`)
    }

    const review = reviewScreeningRecord(encounter)
    const initial = initialScreeningRecord(encounter)
    const header = await buildPatientHeaderEncounter(encounter)

    const latestResult = [...(lr.labResults ?? [])].sort((a, b) => b.id - a.id)[0] ?? null
    const labTechnicianUser = latestResult?.recordedByUser ?? auth.getUserOrFail()

    const items = serializeLabItemsWithResults(lr, {
      formatDate: (value, format) => value?.toFormat(format ?? 'dd LLL yyyy, HH:mm') ?? null,
      userBadge: (user) => (user ? { name: user.name, role: null } : null),
    })

    return inertia.render('lab/print', {
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
      labRequest: {
        request_number: lr.requestNumber,
        priority_level: lr.priorityLevel,
        status: lr.status,
        request_notes: lr.requestNotes,
        requested_by: lr.requestedByUser?.name ?? null,
        requested_at: lr.requestedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
        completed_at: lr.completedAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
        items,
      },
      labTechnician: {
        name: labTechnicianUser.name,
        signature_url: labTechnicianUser.signaturePath
          ? `/storage/${labTechnicianUser.signaturePath}`
          : null,
      },
      printedAt: DateTime.now().toFormat('dd LLL yyyy, HH:mm'),
    })
  }

  // GET /lab/:encounter/items  (JSON)
  async itemsJson({ params, response }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await encounter.load('labRequests', (q) => {
      q.preload('labRequestItems')
      q.preload('labResults')
    })
    const lr = encounter.labRequests?.[0] ?? null

    const items =
      lr && lr.labRequestItems.length
        ? lr.labRequestItems.map((item) => ({
            id: item.id,
            test_name: item.testName,
            specimen: item.specimenType ?? '—',
            group: item.testGroup ?? '—',
            instructions: item.instructions ?? null,
            order_date: lr.requestedAt?.toFormat('dd LLL yyyy') ?? null,
            order_number: lr.requestNumber,
            priority: lr.priorityLevel ?? 'normal',
            result_value:
              lr.labResults.find((r) => r.labRequestItemId === item.id)?.resultValue ?? '—',
          }))
        : []

    return response.json({ items })
  }

  // GET /lab/:encounter/add-tests
  async addTests({ params, response, session, inertia, bouncer, auth }: HttpContext) {
    auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Lab)

    await encounter.load('patient')
    await encounter.load('labRequests', (q) => q.preload('labRequestItems'))

    const groups = await TestType.query()
      .where('isActive', true)
      .whereNotNull('description')
      .whereNot('description', 'Composite Panel')
      .distinct('description')
      .orderBy('description')

    const lr = encounter.labRequests?.[0] ?? null

    void response
    void session
    return inertia.render('lab/add-tests', {
      encounter: {
        id: encounter.id,
        encounter_number: encounter.encounterNumber,
        patient_name: encounter.patient?.fullName ?? null,
      },
      groups: groups.map((g) => g.description),
      existingItems: (lr?.labRequestItems ?? []).map((i) => ({
        test_name: i.testName,
        specimen_type: i.specimenType,
        lab_specimen_type_id: i.labSpecimenTypeId,
        test_group: i.testGroup,
      })),
      existingPriority: lr?.priorityLevel ?? encounter.priorityLevel ?? 'normal',
    })
  }

  // POST /lab/:encounter/add-tests  (JSON)
  async storeAddedTests({ params, request, response, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Lab)

    const items = (request.input('items', []) as any[]).filter((i) => i && i.test_name)
    if (items.length === 0) {
      return response.status(422).json({ ok: false, message: 'No items provided.' })
    }

    let labRequest = await getLabRequest(encounter.id)
    if (!labRequest) {
      const countRows = await LabRequest.query()
        .whereRaw('DATE(created_at) = CURRENT_DATE')
        .count('* as total')
      const seq = Number((countRows[0] as any).$extras.total) + 1
      labRequest = await LabRequest.create({
        encounterId: encounter.id,
        patientId: encounter.patientId,
        requestedBy: user.id,
        requestNumber: `LAB-${DateTime.now().toFormat('yyyyLLdd')}-${String(seq).padStart(4, '0')}`,
        priorityLevel: String(request.input('priority_level', 'normal')),
        status: 'in_progress',
        requestedAt: DateTime.now(),
      })
    }

    await labRequest.related('labRequestItems').query().delete()

    for (const item of items) {
      let sid: number | null =
        item.lab_specimen_type_id !== undefined && item.lab_specimen_type_id !== ''
          ? Number(item.lab_specimen_type_id)
          : null
      let specimenLabel: string | null = item.specimen_type ?? null
      if (sid) {
        const catalog = await LabSpecimenType.find(sid)
        if (catalog) {
          specimenLabel = catalog.defaultUnit ? `${catalog.name} (${catalog.defaultUnit})` : catalog.name
        } else {
          sid = null
        }
      }

      await labRequest.related('labRequestItems').create({
        testName: item.test_name,
        testCode: item.test_code ?? null,
        specimenType: specimenLabel,
        labSpecimenTypeId: sid,
        testGroup: item.test_group ?? null,
        instructions: item.instructions ?? null,
        status: 'pending',
      })
    }

    await labRequest.load('labRequestItems')
    return response.json({
      ok: true,
      request_number: labRequest.requestNumber,
      item_count: labRequest.labRequestItems.length,
    })
  }

  // POST /lab/:encounter/samples
  async samples({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Lab)

    const labRequest = await getLabRequest(encounter.id)
    if (!labRequest) {
      session.flash('error', 'No lab request found. Receive the patient first.')
      return response.redirect().back()
    }

    const data = await request.validateUsing(labSamplesValidator)

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await labRequest.related('labRequestItems').create({
          testName: item.test_name,
          testCode: item.test_code ?? null,
          specimenType: item.specimen_type ?? null,
          labSpecimenTypeId: item.lab_specimen_type_id ?? null,
          testGroup: item.test_group ?? null,
          instructions: item.instructions ?? null,
          status: 'pending',
        })
      }
    }

    if (data.samples && data.samples.length > 0) {
      await new RecordLabSamplesAction().handle(labRequest, { samples: data.samples }, user.id)
    }

    session.flash('success', 'Sample collection recorded.')
    return response.redirect().toPath(`/lab/${encounter.id}`)
  }

  // POST /lab/:encounter/results
  async results({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    const wantsJson = this.wantsJson(request)

    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Lab)

    const labRequest = await getLabRequest(encounter.id)
    if (!labRequest) {
      if (wantsJson) {
        return response.status(404).json({ ok: false, message: 'No lab request found.' })
      }
      session.flash('error', 'No lab request found.')
      return response.redirect().back()
    }

    const data = await request.validateUsing(labResultsValidator)

    try {
      await new RecordLabResultsAction().handle(labRequest, { results: data.results }, user.id)
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

    session.flash('success', 'Results recorded.')
    return response.redirect().toPath(`/lab/${encounter.id}`)
  }

  // POST /lab/:encounter/results/:result/update
  async updateResult({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Lab)

    const labRequest = await getLabRequest(encounter.id)
    if (!labRequest) {
      session.flash('error', 'No lab request found.')
      return response.redirect().back()
    }

    const result = await LabResult.findOrFail(params.result)
    if (result.encounterId !== encounter.id || result.labRequestId !== labRequest.id) {
      return response.notFound('Result not found for this encounter.')
    }

    const data = await request.validateUsing(labResultUpdateValidator)

    result.merge({
      resultValue: data.result_value ?? null,
      resultText: data.result_text ?? null,
      referenceRange: data.reference_range ?? null,
      interpretation: data.interpretation ?? null,
      remarks: data.remarks ?? null,
      recordedBy: user.id,
      resultRecordedAt: DateTime.now(),
      resultStatus: 'resulted',
      releasedToPatientAt: result.releasedToPatientAt ?? DateTime.now(),
      releasedBy: result.releasedBy ?? user.id,
    })
    await result.save()

    if (result.labRequestItemId) {
      await labRequest
        .related('labRequestItems')
        .query()
        .where('id', result.labRequestItemId)
        .update({ status: 'resulted' })
    }

    session.flash('success', 'Result updated successfully.')
    return response.redirect().toPath(`/lab/${encounter.id}`)
  }

  // POST /lab/:encounter/items/:item/result-meta
  async updateResultMeta({ params, request, response, session, auth, bouncer }: HttpContext) {
    auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('editInStage', encounter, EncounterStage.Lab)

    const labRequest = await getLabRequest(encounter.id)
    if (!labRequest) {
      session.flash('error', 'No lab request found.')
      return response.redirect().back()
    }

    const data = await request.validateUsing(labResultMetaValidator)

    const result = await LabResult.query()
      .where('lab_request_id', labRequest.id)
      .where('lab_request_item_id', Number(params.item))
      .orderBy('id', 'desc')
      .first()

    if (!result) {
      session.flash(
        'error',
        'Record a result value/text first, then add reference range and interpretation.'
      )
      return response.redirect().back()
    }

    result.referenceRange = data.reference_range ?? null
    result.interpretation = data.interpretation ?? null
    await result.save()

    session.flash('success', 'Reference range and interpretation updated.')
    return response.redirect().toPath(`/lab/${encounter.id}`)
  }

  // POST /lab/:encounter/complete
  async complete({ params, request, response, session, auth, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const encounter = await Encounter.findOrFail(params.encounter)
    await (bouncer as any)
      .with('EncounterPolicy')
      .authorize('advanceFromStage', encounter, EncounterStage.Lab)

    const labRequest = await getLabRequest(encounter.id)
    if (!labRequest) {
      session.flash('error', 'No lab request found.')
      return response.redirect().back()
    }

    const data = await request.validateUsing(labCompleteValidator)

    if (data.results && data.results.length > 0) {
      await new RecordLabResultsAction().handle(labRequest, { results: data.results }, user.id)
    }

    await labRequest.load('labResults')
    if (labRequest.labResults.length === 0) {
      session.flash('error', 'At least one result must be recorded before completing the lab stage.')
      return response.redirect().back()
    }

    try {
      await new QueueEncounterBackToScreeningAction().handle(encounter, user.id, data.notes ?? null)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} returned to Screening Review.`)
    return response.redirect().toPath('/lab/queue')
  }
}
