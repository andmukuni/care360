import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import EncounterQueueTransition from '#models/encounter_queue_transition'
import LabRequest from '#models/lab_request'
import PharmacyDispense from '#models/pharmacy_dispense'
import PharmacyPrescription from '#models/pharmacy_prescription'
import ScreeningRecord from '#models/screening_record'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { diagnosisLabel } from '#support/queue/diagnosis_label'
import { queueUserBadge } from '#support/queue/queue_user_badge'
import {
  closedEncounterDayStart,
  encounterDurationHours,
  reopenEligibility,
} from '#support/encounter/reopen_encounter_policy'
import { serializeId, serializeIdOrNull } from '#support/serialize_id'
import QueueCache from '#services/cache/queue_cache'
import {
  apiStageQueueKey,
  closedQueuePageKey,
  pharmacyPartiallyDispensedPageKey,
  stageQueuePageKey,
} from '#services/cache/queue_cache_keys'

export type QueuePaginatorPayload<T> = {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type BaseQueueRow = {
  id: number
  encounter_number: string
  patient_name: string | null
  patient_code: string | null
  patient_barcode: string | null
  visit_type: string | null
  priority: string | null
  updated_at_relative: string | null
  queued_by_name: string | null
  received_by_name: string | null
  has_allergies: boolean
  can_manage: boolean
  received_by_id?: number | null
  patient_age: number | null
}

export type ScreeningQueueRow = BaseQueueRow & {
  is_returned_from_pharmacy: boolean
  return_reason: string | null
  returned_by_name: string | null
  assessment_summary: string | null
}

export type TriageQueueRow = BaseQueueRow & {
  status: string
  temperature: number | null
  queued_by: { name: string; role: string | null } | null
  received_by: { name: string; role: string | null } | null
}

export type LabQueueRow = BaseQueueRow & {
  lab_request_number: string | null
  lab_priority: string | null
  test_count: number
}

export type PharmacyQueueRow = BaseQueueRow & {
  diagnosis: string
  review_diagnosis: string | null
  lab_request_number: string | null
  lab_results_summary: string | null
  lab_results_posted_by: string[]
  prescription_number: string | null
  prescription_item_count: number
  dispensed_item_count: number
  location_label: string | null
  sent_by_name: string
}

export type ScreeningReviewQueueRow = BaseQueueRow & {
  screening_diagnosis: string | null
  lab_request_number: string | null
  lab_priority: string | null
  test_count: number
  lab_requested_by: string | null
  lab_results_posted_by: string[]
  is_returned_loopback: boolean
  return_reason: string | null
  returned_by_name: string | null
  review_summary: string | null
  prescription_number: string | null
}

export type TreatmentRoomQueueRow = BaseQueueRow & {
  source_label: string
  sent_by_name: string
  transition_notes: string | null
  dispensed_medications: { drug_name: string; route: string | null }[]
  show_priority_badge: boolean
}

export type ClosedEncounterRow = {
  id: number
  encounter_number: string
  patient_name: string | null
  patient_code: string | null
  priority: string | null
  closed_at: string | null
  closed_by_name: string | null
  can_reopen: boolean
  reopen_blocked_reason: string | null
  encounter_duration_hours: number | null
}

export function parseQueuePages(
  request: HttpContext['request'],
  options: { includeClosed?: boolean; includePartiallyDispensed?: boolean } = {}
) {
  return {
    queuedPage: Math.max(1, Number(request.qs().queued_page ?? 1)),
    progressPage: Math.max(1, Number(request.qs().progress_page ?? 1)),
    partiallyDispensedPage: options.includePartiallyDispensed
      ? Math.max(1, Number(request.qs().partially_dispensed_page ?? 1))
      : 1,
    closedPage: options.includeClosed ? Math.max(1, Number(request.qs().closed_page ?? 1)) : 1,
  }
}

function applyPartialDispenseOnLatestPrescriptionFilter(query: any) {
  const table = Encounter.table

  return query.whereRaw(`
    EXISTS (
      SELECT 1
      FROM pharmacy_prescriptions latest_rx
      WHERE latest_rx.encounter_id = ${table}.id
        AND latest_rx.id = (
          SELECT MAX(id) FROM pharmacy_prescriptions WHERE encounter_id = ${table}.id
        )
        AND (
          SELECT COUNT(DISTINCT pdi.pharmacy_prescription_item_id)
          FROM pharmacy_dispense_items pdi
          INNER JOIN pharmacy_dispenses pd ON pd.id = pdi.pharmacy_dispense_id
          INNER JOIN pharmacy_prescription_items ppi ON ppi.id = pdi.pharmacy_prescription_item_id
          WHERE pd.encounter_id = ${table}.id
            AND ppi.pharmacy_prescription_id = latest_rx.id
            AND pdi.pharmacy_prescription_item_id IS NOT NULL
        ) > 0
        AND (
          SELECT COUNT(DISTINCT pdi.pharmacy_prescription_item_id)
          FROM pharmacy_dispense_items pdi
          INNER JOIN pharmacy_dispenses pd ON pd.id = pdi.pharmacy_dispense_id
          INNER JOIN pharmacy_prescription_items ppi ON ppi.id = pdi.pharmacy_prescription_item_id
          WHERE pd.encounter_id = ${table}.id
            AND ppi.pharmacy_prescription_id = latest_rx.id
            AND pdi.pharmacy_prescription_item_id IS NOT NULL
        ) < (
          SELECT COUNT(*) FROM pharmacy_prescription_items WHERE pharmacy_prescription_id = latest_rx.id
        )
    )
  `)
}

function applyPharmacyPartiallyDispensedStageFilter(query: any) {
  return query.where((builder: any) => {
    builder
      .where((pharmacyQuery: any) => {
        pharmacyQuery
          .where('current_stage', EncounterStage.Pharmacy)
          .where('current_status', EncounterStatus.InProgress)
      })
      .orWhere((treatmentQuery: any) => {
        treatmentQuery
          .where('current_stage', EncounterStage.TreatmentRoom)
          .whereIn('current_status', [EncounterStatus.Queued, EncounterStatus.InProgress])
      })
  })
}

function applyPharmacyInProgressFilter(query: any) {
  return query.where((builder: any) => {
    builder
      .whereDoesntHave('pharmacyDispenses')
      .orWhereHas('pharmacyPrescriptions', (prescriptionQuery: any) => {
        prescriptionQuery.where('status', 'dispensed').whereRaw(
          `pharmacy_prescriptions.id = (
            SELECT MAX(latest.id)
            FROM pharmacy_prescriptions latest
            WHERE latest.encounter_id = pharmacy_prescriptions.encounter_id
          )`
        )
      })
  })
}

function pharmacyPartiallyDispensedBase(preload?: (query: any) => void) {
  const query = Encounter.query()
    .preload('patient')
    .preload('encounterQueueTransitions', (q: any) =>
      q.preload('queuedByUser').preload('receivedByUser')
    )

  if (preload) preload(query)
  return query
}

export function preloadPharmacyQueueEncounter(query: any) {
  query.preload('screeningRecords', (q: any) =>
    q.whereIn('screening_type', ['initial', 'review_after_lab'])
  )
  query.preload('labRequests', (q: any) => {
    q.preload('labRequestItems')
    q.preload('labResults', (r: any) => r.preload('recordedByUser'))
  })
  query.preload('pharmacyPrescriptions', (q: any) => {
    q.preload('pharmacyPrescriptionItems')
  })
  query.preload('pharmacyDispenses', (q: any) => {
    q.preload('pharmacyDispenseItems')
  })
}

export async function countPharmacyPartiallyDispensedEncounters(): Promise<number> {
  const query = applyPartialDispenseOnLatestPrescriptionFilter(
    applyPharmacyPartiallyDispensedStageFilter(pharmacyPartiallyDispensedBase())
  )
  const rows = await query.count('* as total')
  return Number((rows[0] as any).$extras.total)
}

export async function countPharmacyClosedEncounters(closedSearch = ''): Promise<number> {
  const search = closedSearch.trim()
  const query = Encounter.query()
    .where('is_locked', true)
    .where('current_stage', EncounterStage.Completed)
    .where('closed_at', '>=', closedEncounterDayStart().toSQL()!)

  if (search !== '') {
    query.where((w) => {
      w.whereILike('encounter_number', `%${search}%`).orWhereHas('patient', (patientQuery) => {
        patientQuery
          .whereILike('full_name', `%${search}%`)
          .orWhereILike('patient_id', `%${search}%`)
      })
    })
  }

  const rows = await query.count('* as total')
  return Number((rows[0] as any).$extras.total)
}

export async function isRegistrationClerk(auth: HttpContext['auth']): Promise<boolean> {
  const user = auth.use('web').user ?? null
  if (!user) return false
  const roleNames = await user.getRoleNames()
  return roleNames.includes('registration-clerk')
}

/** Stage → receive permission used to decide queue preview (read-only) mode. */
const STAGE_RECEIVE_PERMISSION: Partial<Record<EncounterStage, string>> = {
  [EncounterStage.Triage]: 'triage.receive',
  [EncounterStage.Screening]: 'screening.receive',
  [EncounterStage.Lab]: 'lab.receive',
  [EncounterStage.ScreeningReview]: 'screening-review.receive',
  [EncounterStage.Pharmacy]: 'pharmacy.receive',
  [EncounterStage.TreatmentRoom]: 'treatment-room.receive',
}

/**
 * True when the user may view the stage queue but cannot receive/manage it.
 * Registration clerks are always preview on non-registration clinical queues.
 */
export async function isQueuePreviewForStage(
  auth: HttpContext['auth'],
  stage: EncounterStage
): Promise<boolean> {
  const user = auth.use('web').user ?? null
  if (!user) return true

  if (await user.hasRole('super-admin')) {
    return false
  }

  if (await isRegistrationClerk(auth) && stage !== EncounterStage.Registration) {
    return true
  }

  const receivePerm = STAGE_RECEIVE_PERMISSION[stage]
  if (!receivePerm) return false

  return !(await user.hasPermission(receivePerm))
}

export async function isSuperAdminUser(auth: HttpContext['auth']): Promise<boolean> {
  const user = auth.use('web').user ?? null
  if (!user) return false
  return user.hasRole('super-admin')
}

export function latestStageTransition(
  transitions: EncounterQueueTransition[] | undefined,
  stage: EncounterStage,
  sortBy: 'queued' | 'received' = 'queued'
): EncounterQueueTransition | null {
  if (!transitions?.length) return null

  return (
    [...transitions]
      .filter((transition) => transition.toStage === stage)
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
  )
}

export function canManageEncounter(
  transition: EncounterQueueTransition | null,
  currentUserId: number | null
): boolean {
  const receivedById = transition?.receivedBy ?? null
  return !receivedById || (currentUserId !== null && receivedById === currentUserId)
}

type CanManagePatchable = {
  can_manage: boolean
  received_by_id?: number | null
}

export function patchQueueCanManage<T extends CanManagePatchable>(
  payload: QueuePaginatorPayload<T>,
  currentUserId: number | null,
  forceManage = false
): QueuePaginatorPayload<Omit<T, 'received_by_id'>> {
  return {
    data: payload.data.map((row) => {
      const receivedById = row.received_by_id ?? null
      const { received_by_id: _ignored, ...rest } = row
      return {
        ...rest,
        can_manage:
          forceManage ||
          !receivedById ||
          (currentUserId !== null && receivedById === currentUserId),
      } as Omit<T, 'received_by_id'>
    }),
    meta: payload.meta,
  }
}

export function patientAgeYears(dob: DateTime | null | undefined): number | null {
  if (!dob) return null
  return Math.floor(DateTime.now().diff(dob, 'years').years)
}

export function paginatorPayload<T>(
  paginator: {
    all: () => any[]
    currentPage: number
    lastPage: number
    perPage: number
    total: number
  },
  mapper: (encounter: Encounter) => T
): QueuePaginatorPayload<T> {
  return {
    data: paginator.all().map((row) => mapper(row as Encounter)),
    meta: {
      current_page: paginator.currentPage,
      last_page: paginator.lastPage,
      per_page: paginator.perPage,
      total: paginator.total,
    },
  }
}

export function baseQueueRow(
  encounter: Encounter,
  options: {
    stage: EncounterStage
    currentUserId: number | null
    inProgress?: boolean
  }
): BaseQueueRow {
  const transition = latestStageTransition(
    encounter.encounterQueueTransitions,
    options.stage,
    options.inProgress ? 'received' : 'queued'
  )

  return {
    id: serializeId(encounter.id),
    encounter_number: encounter.encounterNumber,
    patient_name: encounter.patient?.fullName ?? null,
    patient_code: encounter.patient?.patientId ?? null,
    patient_barcode: encounter.patient?.barcode ?? null,
    visit_type: encounter.visitType,
    priority: encounter.priorityLevel,
    updated_at_relative: encounter.updatedAt?.toRelative() ?? null,
    queued_by_name: transition?.queuedByUser?.name ?? 'Unknown user',
    received_by_name: transition?.receivedByUser?.name ?? null,
    has_allergies: Boolean(encounter.patient?.allergies?.trim()),
    can_manage: canManageEncounter(transition, options.currentUserId),
    received_by_id: serializeIdOrNull(transition?.receivedBy),
    patient_age: patientAgeYears(encounter.patient?.dateOfBirth),
  }
}

export function applyScreeningCategoryFilter(query: any, cat: 'adult' | 'pediatric') {
  const cutoff = DateTime.now().minus({ years: 5 }).toISODate()!

  return query.whereHas('patient', (patientQuery: any) => {
    if (cat === 'pediatric') {
      patientQuery.whereNotNull('date_of_birth').where('date_of_birth', '>', cutoff)
    } else {
      patientQuery.where((w: any) =>
        w.whereNull('date_of_birth').orWhere('date_of_birth', '<=', cutoff)
      )
    }
  })
}

export async function screeningCategoryCounts(
  cat: 'adult' | 'pediatric',
  queuedTotal: number,
  inProgressTotal: number
) {
  const countFor = async (category: 'adult' | 'pediatric') => {
    const query = Encounter.query()
      .where('current_stage', EncounterStage.Screening)
      .whereIn('current_status', [EncounterStatus.Queued, EncounterStatus.InProgress])
    applyScreeningCategoryFilter(query, category)
    const rows = await query.count('* as total')
    return Number((rows[0] as any).$extras.total)
  }

  return {
    adult: cat === 'adult' ? queuedTotal + inProgressTotal : await countFor('adult'),
    pediatric:
      cat === 'pediatric' ? queuedTotal + inProgressTotal : await countFor('pediatric'),
  }
}

export function latestPrescription(encounter: Encounter): PharmacyPrescription | null {
  return (
    (encounter.pharmacyPrescriptions ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
  )
}

export function partialDispenseCounts(
  encounter: Encounter
): { dispensed: number; total: number } {
  const prescription = latestPrescription(encounter)
  const total = prescription?.pharmacyPrescriptionItems?.length ?? 0
  if (!prescription || total === 0) {
    return { dispensed: 0, total: 0 }
  }

  const rxItemIds = new Set((prescription.pharmacyPrescriptionItems ?? []).map((item) => item.id))
  const dispensedIds = new Set<number>()

  for (const record of encounter.pharmacyDispenses ?? []) {
    for (const item of record.pharmacyDispenseItems ?? []) {
      if (item.pharmacyPrescriptionItemId && rxItemIds.has(item.pharmacyPrescriptionItemId)) {
        dispensedIds.add(item.pharmacyPrescriptionItemId)
      }
    }
  }

  return { dispensed: dispensedIds.size, total }
}

export function latestDispense(encounter: Encounter): PharmacyDispense | null {
  return (encounter.pharmacyDispenses ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
}

export function initialScreeningRecord(encounter: Encounter): ScreeningRecord | null {
  return (
    (encounter.screeningRecords ?? []).find((record) => record.screeningType === 'initial') ??
    null
  )
}

export function reviewScreeningRecord(encounter: Encounter): ScreeningRecord | null {
  return (
    (encounter.screeningRecords ?? [])
      .filter((record) => record.screeningType === 'review_after_lab')
      .sort((a, b) => b.id - a.id)[0] ?? null
  )
}

export function latestLabRequest(encounter: Encounter): LabRequest | null {
  return (encounter.labRequests ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
}

export function summarizeLabResultsForQueue(lr: LabRequest | null): string | null {
  if (!lr) return null

  const items = lr.labRequestItems ?? []
  if (items.length === 0) return null

  const resultsByItemId = new Map<number, (typeof lr.labResults)[number]>()
  for (const result of lr.labResults ?? []) {
    if (result.labRequestItemId) {
      resultsByItemId.set(result.labRequestItemId, result)
    }
  }

  let recorded = 0
  let abnormal = 0
  let critical = 0

  for (const item of items) {
    const result = resultsByItemId.get(item.id)
    if (!result) continue

    const hasValue = Boolean(
      result.resultValue?.trim() ||
        result.resultText?.trim() ||
        result.referenceRange?.trim() ||
        result.interpretation?.trim() ||
        result.remarks?.trim()
    )
    if (!hasValue) continue

    recorded += 1
    const interpretation = String(result.interpretation ?? '').toLowerCase()
    if (interpretation === 'critical') critical += 1
    else if (interpretation === 'abnormal') abnormal += 1
  }

  const parts: string[] = []
  if (lr.requestNumber) parts.push(lr.requestNumber)

  if (recorded > 0) {
    parts.push(`${recorded}/${items.length} result${recorded === 1 ? '' : 's'}`)
    if (critical > 0) parts.push(`${critical} critical`)
    else if (abnormal > 0) parts.push(`${abnormal} abnormal`)
  } else {
    parts.push(`${items.length} test${items.length === 1 ? '' : 's'} pending`)
  }

  return parts.join(' · ')
}

function truncateText(value: string | null | undefined, maxLength: number): string | null {
  if (!value?.trim()) return null
  const text = value.trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export function screeningQueueRow(
  encounter: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean }
): ScreeningQueueRow {
  const base = baseQueueRow(encounter, {
    stage: EncounterStage.Screening,
    currentUserId: options.currentUserId,
    inProgress: options.inProgress,
  })

  const latestQueuedToScreening = latestStageTransition(
    encounter.encounterQueueTransitions,
    EncounterStage.Screening,
    'queued'
  )
  const isReturnedFromPharmacy =
    latestQueuedToScreening?.fromStage === EncounterStage.Pharmacy

  const sr = initialScreeningRecord(encounter)
  const assessmentSummary = options.inProgress
    ? (diagnosisLabel(sr?.provisionalDiagnosis ?? sr?.complaints ?? null, 120) ??
      'Assessment started. Continue clinical review.')
    : null

  return {
    ...base,
    is_returned_from_pharmacy: isReturnedFromPharmacy,
    return_reason: isReturnedFromPharmacy
      ? truncateText(latestQueuedToScreening?.transitionNotes ?? null, 140)
      : null,
    returned_by_name: isReturnedFromPharmacy
      ? (latestQueuedToScreening?.queuedByUser?.name ?? 'Unknown user')
      : null,
    assessment_summary: assessmentSummary,
  }
}

export function triageQueueRow(
  encounter: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean }
): TriageQueueRow {
  const base = baseQueueRow(encounter, {
    stage: EncounterStage.Triage,
    currentUserId: options.currentUserId,
    inProgress: options.inProgress,
  })
  const transition = latestStageTransition(
    encounter.encounterQueueTransitions,
    EncounterStage.Triage,
    options.inProgress ? 'received' : 'queued'
  )
  const triage = encounter.triageRecords?.[0] ?? null

  return {
    ...base,
    status: encounter.currentStatus,
    temperature: triage?.temperature ?? null,
    queued_by: queueUserBadge(transition?.queuedByUser),
    received_by: queueUserBadge(transition?.receivedByUser),
  }
}

export function labQueueRow(
  encounter: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean }
): LabQueueRow {
  const base = baseQueueRow(encounter, {
    stage: EncounterStage.Lab,
    currentUserId: options.currentUserId,
    inProgress: options.inProgress,
  })
  const lr = latestLabRequest(encounter)

  return {
    ...base,
    lab_request_number: lr?.requestNumber ?? null,
    lab_priority: lr?.priorityLevel ?? encounter.priorityLevel,
    test_count: lr?.labRequestItems?.length ?? 0,
  }
}

export function pharmacyQueueRow(
  encounter: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean }
): PharmacyQueueRow {
  const base = baseQueueRow(encounter, {
    stage: EncounterStage.Pharmacy,
    currentUserId: options.currentUserId,
    inProgress: options.inProgress,
  })

  const review = reviewScreeningRecord(encounter)
  const initial = initialScreeningRecord(encounter)
  const lr = latestLabRequest(encounter)
  const reviewDiagnosis = diagnosisLabel(review?.finalDiagnosis ?? null, 110)
  const diagnosis =
    reviewDiagnosis ??
    diagnosisLabel(
      initial?.finalDiagnosis ?? initial?.provisionalDiagnosis ?? null,
      110
    ) ??
    'No diagnosis recorded'

  const labResultsPostedBy = [
    ...new Set(
      (lr?.labResults ?? [])
        .map((result) => result.recordedByUser?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ]

  const prescription = latestPrescription(encounter)
  const { dispensed, total } = partialDispenseCounts(encounter)
  const latestToPharmacy = latestStageTransition(
    encounter.encounterQueueTransitions,
    EncounterStage.Pharmacy,
    options.inProgress ? 'received' : 'queued'
  )

  return {
    ...base,
    diagnosis,
    review_diagnosis: reviewDiagnosis,
    lab_request_number: lr?.requestNumber ?? null,
    lab_results_summary: summarizeLabResultsForQueue(lr),
    lab_results_posted_by: labResultsPostedBy,
    prescription_number: prescription?.prescriptionNumber ?? null,
    prescription_item_count: total || (prescription?.pharmacyPrescriptionItems?.length ?? 0),
    dispensed_item_count: dispensed,
    location_label:
      encounter.currentStage === EncounterStage.Pharmacy
        ? null
        : EncounterStageHelper.label(encounter.currentStage),
    sent_by_name:
      latestToPharmacy?.queuedByUser?.name ??
      prescription?.prescribedByUser?.name ??
      'Unknown user',
  }
}

export function screeningReviewQueueRow(
  encounter: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean }
): ScreeningReviewQueueRow {
  const base = baseQueueRow(encounter, {
    stage: EncounterStage.ScreeningReview,
    currentUserId: options.currentUserId,
    inProgress: options.inProgress,
  })

  const initial = initialScreeningRecord(encounter)
  const review = reviewScreeningRecord(encounter)
  const lr = latestLabRequest(encounter)

  const latestTransitionToReview = latestStageTransition(
    encounter.encounterQueueTransitions,
    EncounterStage.ScreeningReview,
    'queued'
  )
  const isReturnedLoopback = Boolean(
    latestTransitionToReview && latestTransitionToReview.fromStage !== EncounterStage.Lab
  )

  const labTransitionFromLab = [...(encounter.encounterQueueTransitions ?? [])]
    .filter(
      (transition) =>
        transition.fromStage === EncounterStage.Lab &&
        transition.toStage === EncounterStage.ScreeningReview
    )
    .sort(
      (a, b) =>
        (b.queuedAt ?? b.createdAt)?.toMillis() - (a.queuedAt ?? a.createdAt)?.toMillis()
    )[0]

  const labResultsPostedBy = [
    ...new Set(
      (lr?.labResults ?? [])
        .map((result) => result.recordedByUser?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ]
  if (labResultsPostedBy.length === 0 && labTransitionFromLab?.queuedByUser?.name) {
    labResultsPostedBy.push(labTransitionFromLab.queuedByUser.name)
  }

  const reviewSummary = options.inProgress
    ? (diagnosisLabel(
        review?.clinicalFindings ??
          review?.assessmentNotes ??
          initial?.provisionalDiagnosis ??
          initial?.complaints ??
          null,
        110
      ) ?? 'Review in progress.')
    : null

  const prescription = latestPrescription(encounter)

  return {
    ...base,
    screening_diagnosis: diagnosisLabel(
      initial?.provisionalDiagnosis ?? initial?.complaints ?? null,
      90
    ),
    lab_request_number: lr?.requestNumber ?? null,
    lab_priority: lr?.priorityLevel ?? encounter.priorityLevel,
    test_count: lr?.labRequestItems?.length ?? 0,
    lab_requested_by: lr?.requestedByUser?.name ?? null,
    lab_results_posted_by: labResultsPostedBy,
    is_returned_loopback: isReturnedLoopback,
    return_reason: isReturnedLoopback
      ? truncateText(latestTransitionToReview?.transitionNotes ?? null, 110)
      : null,
    returned_by_name: isReturnedLoopback
      ? (latestTransitionToReview?.queuedByUser?.name ?? 'Unknown user')
      : null,
    review_summary: reviewSummary,
    prescription_number: options.inProgress ? (prescription?.prescriptionNumber ?? null) : null,
  }
}

export function treatmentRoomQueueRow(
  encounter: Encounter,
  options: { currentUserId: number | null; inProgress?: boolean }
): TreatmentRoomQueueRow {
  const base = baseQueueRow(encounter, {
    stage: EncounterStage.TreatmentRoom,
    currentUserId: options.currentUserId,
    inProgress: options.inProgress,
  })

  const latestTransition = latestStageTransition(
    encounter.encounterQueueTransitions,
    EncounterStage.TreatmentRoom,
    options.inProgress ? 'received' : 'queued'
  )
  const fromStage = latestTransition?.fromStage ?? EncounterStage.Pharmacy
  const sourceLabel =
    fromStage === EncounterStage.Screening
      ? 'From Screening'
      : fromStage === EncounterStage.ScreeningReview
        ? 'From Screening Review'
        : fromStage === EncounterStage.Pharmacy
          ? 'From Pharmacy'
          : EncounterStageHelper.label(fromStage)

  const dispense = latestDispense(encounter)
  const dispensedMedications = (dispense?.pharmacyDispenseItems ?? [])
    .slice(0, 5)
    .map((item) => ({
      drug_name: item.drugName,
      route: item.pharmacyPrescriptionItem?.route ?? null,
    }))

  return {
    ...base,
    source_label: sourceLabel,
    sent_by_name:
      latestTransition?.queuedByUser?.name ??
      String(fromStage).replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase()),
    transition_notes: latestTransition?.transitionNotes ?? null,
    dispensed_medications: dispensedMedications,
    show_priority_badge: Boolean(
      encounter.priorityLevel && encounter.priorityLevel !== 'normal'
    ),
  }
}

export function closedEncounterRow(encounter: Encounter): ClosedEncounterRow {
  const eligibility = reopenEligibility(encounter)
  const durationHours = encounter.closedAt ? encounterDurationHours(encounter) : null

  return {
    id: serializeId(encounter.id),
    encounter_number: encounter.encounterNumber,
    patient_name: encounter.patient?.fullName ?? null,
    patient_code: encounter.patient?.patientId ?? null,
    priority: encounter.priorityLevel,
    closed_at: encounter.closedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
    closed_by_name: encounter.closedByUser?.name ?? 'Unknown user',
    can_reopen: eligibility.allowed,
    reopen_blocked_reason: eligibility.reason,
    encounter_duration_hours:
      durationHours === null ? null : Math.round(durationHours * 10) / 10,
  }
}

export async function paginateScreeningCategoryQueue(options: {
  cat: 'adult' | 'pediatric'
  queuedPage: number
  progressPage: number
  currentUserId: number | null
  forceManage?: boolean
}) {
  const cacheKey = stageQueuePageKey({
    stage: EncounterStage.Screening,
    scope: options.cat,
    queuedPage: options.queuedPage,
    progressPage: options.progressPage,
    orderBy: 'clinical',
  })

  const cached = await QueueCache.getOrSet(cacheKey, EncounterStage.Screening, async () => {
    const { queuedPaginator, inProgressPaginator } = await paginateStageQueue({
      stage: EncounterStage.Screening,
      queuedPage: options.queuedPage,
      progressPage: options.progressPage,
      orderBy: 'clinical',
      applyFilter: (query) => applyScreeningCategoryFilter(query, options.cat),
      preload: (query) => {
        query.preload('screeningRecords', (q: any) => q.where('screening_type', 'initial'))
      },
    })

    return {
      queued: paginatorPayload(queuedPaginator, (encounter) =>
        screeningQueueRow(encounter, { currentUserId: null })
      ),
      inProgress: paginatorPayload(inProgressPaginator, (encounter) =>
        screeningQueueRow(encounter, { currentUserId: null, inProgress: true })
      ),
      queueTotal: queuedPaginator.total + inProgressPaginator.total,
    }
  })

  return {
    queued: patchQueueCanManage(cached.queued, options.currentUserId, options.forceManage),
    inProgress: patchQueueCanManage(cached.inProgress, options.currentUserId, options.forceManage),
    queueTotal: cached.queueTotal,
  }
}

export async function paginateCachedStageQueue<T extends BaseQueueRow>(options: {
  stage: EncounterStage
  queuedPage: number
  progressPage: number
  currentUserId: number | null
  forceManage?: boolean
  cacheScope?: string
  perPage?: number
  orderBy?: QueueOrder
  applyFilter?: (query: any) => void
  preload?: (query: any) => void
  mapRow: (encounter: Encounter, inProgress: boolean) => T
}) {
  const cacheKey = stageQueuePageKey({
    stage: options.stage,
    scope: options.cacheScope,
    queuedPage: options.queuedPage,
    progressPage: options.progressPage,
    orderBy: options.orderBy,
  })

  const cached = await QueueCache.getOrSet(cacheKey, options.stage, async () => {
    const { queuedPaginator, inProgressPaginator } = await paginateStageQueue({
      stage: options.stage,
      queuedPage: options.queuedPage,
      progressPage: options.progressPage,
      perPage: options.perPage,
      orderBy: options.orderBy,
      applyFilter: options.applyFilter,
      preload: options.preload,
    })

    return {
      queued: paginatorPayload(queuedPaginator, (encounter) => options.mapRow(encounter, false)),
      inProgress: paginatorPayload(inProgressPaginator, (encounter) =>
        options.mapRow(encounter, true)
      ),
    }
  })

  return {
    queued: patchQueueCanManage(cached.queued, options.currentUserId, options.forceManage),
    inProgress: patchQueueCanManage(cached.inProgress, options.currentUserId, options.forceManage),
  }
}

export async function paginateCachedTriageQueue(options: {
  queuedPage: number
  progressPage: number
  currentUserId: number | null
  forceManage?: boolean
}) {
  return paginateCachedStageQueue({
    stage: EncounterStage.Triage,
    queuedPage: options.queuedPage,
    progressPage: options.progressPage,
    currentUserId: options.currentUserId,
    forceManage: options.forceManage,
    orderBy: 'started_at',
    preload: (query) => {
      query.preload('triageRecords', (q: any) => q.orderBy('id', 'desc'))
    },
    mapRow: (encounter, inProgress) =>
      triageQueueRow(encounter, { currentUserId: null, inProgress }),
  })
}

type QueueOrder = 'clinical' | 'lab' | 'updated_at' | 'started_at'

export async function paginateStageQueue(options: {
  stage: EncounterStage
  queuedPage: number
  progressPage: number
  perPage?: number
  orderBy?: QueueOrder
  applyFilter?: (query: any) => void
  preload?: (query: any) => void
}) {
  const perPage = options.perPage ?? 20

  const base = () => {
    const query = Encounter.query()
      .preload('patient')
      .preload('encounterQueueTransitions', (q: any) =>
        q.preload('queuedByUser').preload('receivedByUser')
      )

    if (options.preload) options.preload(query)
    query.where('current_stage', options.stage)
    if (options.applyFilter) options.applyFilter(query)
    return query
  }

  const applyOrder = (query: any) => {
    if (options.orderBy === 'lab') {
      return Encounter.orderByLabQueuePriority(query, 'updated_at')
    }
    if (options.orderBy === 'started_at') {
      return Encounter.orderByClinicalPriority(query, 'started_at')
    }
    if (options.orderBy === 'clinical') {
      return Encounter.orderByClinicalPriority(query, 'updated_at')
    }
    return query.orderBy('updated_at', 'asc')
  }

  const queuedPaginator = await applyOrder(
    base().where('current_status', EncounterStatus.Queued)
  ).paginate(options.queuedPage, perPage)

  const inProgressPaginator = await applyOrder(
    base().where('current_status', EncounterStatus.InProgress)
  ).paginate(options.progressPage, perPage)

  return { queuedPaginator, inProgressPaginator }
}

export async function paginatePharmacyPrimaryQueue(options: {
  queuedPage: number
  progressPage: number
  perPage?: number
  preload?: (query: any) => void
}) {
  const perPage = options.perPage ?? 20

  const base = () => {
    const query = Encounter.query()
      .preload('patient')
      .preload('encounterQueueTransitions', (q: any) =>
        q.preload('queuedByUser').preload('receivedByUser')
      )

    if (options.preload) options.preload(query)
    query.where('current_stage', EncounterStage.Pharmacy)
    return query
  }

  const applyOrder = (query: any) => Encounter.orderByClinicalPriority(query, 'updated_at')

  const [queuedPaginator, inProgressPaginator] = await Promise.all([
    applyOrder(base().where('current_status', EncounterStatus.Queued)).paginate(
      options.queuedPage,
      perPage
    ),
    applyOrder(
      applyPharmacyInProgressFilter(base().where('current_status', EncounterStatus.InProgress))
    ).paginate(options.progressPage, perPage),
  ])

  return { queuedPaginator, inProgressPaginator }
}

export async function paginatePharmacyPartiallyDispensedQueue(options: {
  partiallyDispensedPage: number
  perPage?: number
  preload?: (query: any) => void
}) {
  const perPage = options.perPage ?? 20
  const applyOrder = (query: any) => Encounter.orderByClinicalPriority(query, 'updated_at')

  return applyOrder(
    applyPartialDispenseOnLatestPrescriptionFilter(
      applyPharmacyPartiallyDispensedStageFilter(pharmacyPartiallyDispensedBase(options.preload))
    )
  ).paginate(options.partiallyDispensedPage, perPage)
}

export async function paginatePharmacyQueue(options: {
  queuedPage: number
  progressPage: number
  partiallyDispensedPage: number
  perPage?: number
  preload?: (query: any) => void
}) {
  const [primary, partiallyDispensedPaginator] = await Promise.all([
    paginatePharmacyPrimaryQueue({
      queuedPage: options.queuedPage,
      progressPage: options.progressPage,
      perPage: options.perPage,
      preload: options.preload,
    }),
    paginatePharmacyPartiallyDispensedQueue({
      partiallyDispensedPage: options.partiallyDispensedPage,
      perPage: options.perPage,
      preload: options.preload,
    }),
  ])

  return {
    ...primary,
    partiallyDispensedPaginator,
  }
}

export async function paginateClosedEncounters(options: {
  closedPage: number
  closedSearch?: string
  perPage?: number
}) {
  const perPage = options.perPage ?? 15
  const search = options.closedSearch?.trim() ?? ''

  const query = Encounter.query()
    .preload('patient')
    .preload('closedByUser')
    .where('is_locked', true)
    .where('current_stage', EncounterStage.Completed)
    .where('closed_at', '>=', closedEncounterDayStart().toSQL()!)

  if (search !== '') {
    query.where((w) => {
      w.whereILike('encounter_number', `%${search}%`).orWhereHas('patient', (patientQuery) => {
        patientQuery
          .whereILike('full_name', `%${search}%`)
          .orWhereILike('patient_id', `%${search}%`)
      })
    })
  }

  return query.orderBy('closed_at', 'desc').paginate(options.closedPage, perPage)
}

export async function paginateCachedPharmacyPrimaryQueue(options: {
  queuedPage: number
  progressPage: number
  currentUserId: number | null
  forceManage?: boolean
  preload?: (query: any) => void
}) {
  const cacheKey = stageQueuePageKey({
    stage: EncounterStage.Pharmacy,
    queuedPage: options.queuedPage,
    progressPage: options.progressPage,
    orderBy: 'clinical',
  })

  const cached = await QueueCache.getOrSet(cacheKey, EncounterStage.Pharmacy, async () => {
    const { queuedPaginator, inProgressPaginator } = await paginatePharmacyPrimaryQueue({
      queuedPage: options.queuedPage,
      progressPage: options.progressPage,
      preload: options.preload,
    })

    return {
      queued: paginatorPayload(queuedPaginator, (encounter) =>
        pharmacyQueueRow(encounter, { currentUserId: null })
      ),
      inProgress: paginatorPayload(inProgressPaginator, (encounter) =>
        pharmacyQueueRow(encounter, { currentUserId: null, inProgress: true })
      ),
    }
  })

  return {
    queued: patchQueueCanManage(cached.queued, options.currentUserId, options.forceManage),
    inProgress: patchQueueCanManage(cached.inProgress, options.currentUserId, options.forceManage),
  }
}

export async function paginateCachedPharmacyPartiallyDispensed(options: {
  partiallyDispensedPage: number
  currentUserId: number | null
  forceManage?: boolean
  preload?: (query: any) => void
}) {
  const cacheKey = pharmacyPartiallyDispensedPageKey(options.partiallyDispensedPage)

  const cached = await QueueCache.getOrSet(cacheKey, EncounterStage.Pharmacy, async () => {
    const partiallyDispensedPaginator = await paginatePharmacyPartiallyDispensedQueue({
      partiallyDispensedPage: options.partiallyDispensedPage,
      preload: options.preload,
    })

    return paginatorPayload(partiallyDispensedPaginator, (encounter) =>
      pharmacyQueueRow(encounter, { currentUserId: null, inProgress: true })
    )
  })

  return patchQueueCanManage(cached, options.currentUserId, options.forceManage)
}

/** @deprecated Use paginateCachedPharmacyPrimaryQueue + paginateCachedPharmacyPartiallyDispensed */
export async function paginateCachedPharmacyQueue(options: {
  queuedPage: number
  progressPage: number
  partiallyDispensedPage: number
  currentUserId: number | null
  forceManage?: boolean
  preload?: (query: any) => void
}) {
  const [primary, partiallyDispensed] = await Promise.all([
    paginateCachedPharmacyPrimaryQueue({
      queuedPage: options.queuedPage,
      progressPage: options.progressPage,
      currentUserId: options.currentUserId,
      forceManage: options.forceManage,
      preload: options.preload,
    }),
    paginateCachedPharmacyPartiallyDispensed({
      partiallyDispensedPage: options.partiallyDispensedPage,
      currentUserId: options.currentUserId,
      forceManage: options.forceManage,
      preload: options.preload,
    }),
  ])

  return {
    ...primary,
    partiallyDispensed,
  }
}

export async function paginateCachedClosedEncounters(options: {
  closedPage: number
  closedSearch?: string
  perPage?: number
}) {
  const search = options.closedSearch?.trim() ?? ''
  const cacheKey = closedQueuePageKey(EncounterStage.Pharmacy, options.closedPage, search)

  return QueueCache.getOrSet(cacheKey, EncounterStage.Pharmacy, async () => {
    const closedPaginator = await paginateClosedEncounters(options)
    return paginatorPayload(closedPaginator, closedEncounterRow)
  })
}

export { apiStageQueueKey }
