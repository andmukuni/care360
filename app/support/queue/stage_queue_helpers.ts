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
import {
  closedEncounterDayStart,
  encounterDurationHours,
  reopenEligibility,
} from '#support/encounter/reopen_encounter_policy'

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
  patient_age: number | null
}

export type ScreeningQueueRow = BaseQueueRow & {
  is_returned_from_pharmacy: boolean
  return_reason: string | null
  returned_by_name: string | null
  assessment_summary: string | null
}

export type LabQueueRow = BaseQueueRow & {
  lab_request_number: string | null
  lab_priority: string | null
  test_count: number
}

export type PharmacyQueueRow = BaseQueueRow & {
  diagnosis: string
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

export async function isRegistrationClerk(auth: HttpContext['auth']): Promise<boolean> {
  const user = auth.use('web').user ?? null
  if (!user) return false
  const roleNames = await user.getRoleNames()
  return roleNames.includes('registration-clerk')
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
    id: encounter.id,
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
  const diagnosis =
    diagnosisLabel(
      review?.finalDiagnosis ??
        initial?.finalDiagnosis ??
        initial?.provisionalDiagnosis ??
        null,
      110
    ) ?? 'No diagnosis recorded'

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
    fromStage === EncounterStage.Screening ? 'From Screening' : 'From Pharmacy'

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
    id: encounter.id,
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
}) {
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
      screeningQueueRow(encounter, { currentUserId: options.currentUserId })
    ),
    inProgress: paginatorPayload(inProgressPaginator, (encounter) =>
      screeningQueueRow(encounter, { currentUserId: options.currentUserId, inProgress: true })
    ),
    queueTotal: queuedPaginator.total + inProgressPaginator.total,
  }
}

type QueueOrder = 'clinical' | 'lab' | 'updated_at'

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

export async function paginatePharmacyQueue(options: {
  queuedPage: number
  progressPage: number
  partiallyDispensedPage: number
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

  const queuedPaginator = await applyOrder(
    base().where('current_status', EncounterStatus.Queued)
  ).paginate(options.queuedPage, perPage)

  const inProgressPaginator = await applyOrder(
    applyPharmacyInProgressFilter(base().where('current_status', EncounterStatus.InProgress))
  ).paginate(options.progressPage, perPage)

  const partiallyDispensedBase = () => {
    const query = Encounter.query()
      .preload('patient')
      .preload('encounterQueueTransitions', (q: any) =>
        q.preload('queuedByUser').preload('receivedByUser')
      )

    if (options.preload) options.preload(query)
    return query
  }

  const partiallyDispensedPaginator = await applyOrder(
    applyPartialDispenseOnLatestPrescriptionFilter(
      applyPharmacyPartiallyDispensedStageFilter(partiallyDispensedBase())
    )
  ).paginate(options.partiallyDispensedPage, perPage)

  return { queuedPaginator, inProgressPaginator, partiallyDispensedPaginator }
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
