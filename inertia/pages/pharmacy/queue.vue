<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { onMounted, reactive, ref } from 'vue'
import StaffLayout from '~/layouts/StaffLayout.vue'
import EncounterBadge from '~/components/encounter/EncounterBadge.vue'
import { shouldShowPriorityBadge } from '~/support/priority_badges'
import QueuePageShell from '~/components/staff/queue/QueuePageShell.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueReceiveButton from '~/components/staff/queue/QueueReceiveButton.vue'
import QueueRecordButton from '~/components/staff/queue/QueueRecordButton.vue'
import QueuePagination from '~/components/staff/queue/QueuePagination.vue'
import QueueEncounterCell from '~/components/staff/queue/QueueEncounterCell.vue'
import QueuePatientCell from '~/components/staff/queue/QueuePatientCell.vue'
import QueueInlineCell from '~/components/staff/queue/QueueInlineCell.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useStageQueue, type QueuePaginatorMeta } from '~/composables/useStageQueue'

type Row = {
  id: number
  encounter_number: string
  patient_name: string | null
  priority: string | null
  updated_at_relative: string | null
  received_by_name: string | null
  can_manage: boolean
  diagnosis: string
  prescription_number: string | null
  prescription_item_count: number
  dispensed_item_count: number
  location_label: string | null
  sent_by_name: string
}

type ClosedRow = {
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

type Paginator<T> = { data: T[]; meta: QueuePaginatorMeta }

const props = defineProps<{
  isRegistrationClerk: boolean
  closedSearch: string
  reopenStages: { value: string; label: string }[]
  queued: Paginator<Row>
  inProgress: Paginator<Row>
  partiallyDispensed: Paginator<Row>
  closedEncounters: Paginator<ClosedRow>
}>()

const { tab, receivingId, queueUrl, receive } = useStageQueue('/pharmacy/queue', {
  pollOnly: ['queued', 'inProgress', 'partiallyDispensed', 'closedEncounters'],
})
const { processingId: reopeningId, runFor: runReopen } = useAsyncAction<number>()
const searchInput = ref(props.closedSearch)
const reopenDrafts = reactive<Record<number, { reason: string }>>({})
const reopeningTarget = ref<{ encounterId: number; stage: string } | null>(null)

function listExtraParams() {
  return props.closedSearch ? { closed_search: props.closedSearch } : undefined
}

function listPaginationProps() {
  return {
    queued: props.queued,
    inProgress: props.inProgress,
    partiallyDispensed: props.partiallyDispensed,
    closedEncounters: props.closedEncounters,
    extraParams: listExtraParams(),
  }
}

function reopenDraft(row: ClosedRow) {
  if (!reopenDrafts[row.id]) reopenDrafts[row.id] = { reason: '' }
  return reopenDrafts[row.id]
}

function isReopeningTo(row: ClosedRow, stageValue: string) {
  return reopeningId.value === row.id && reopeningTarget.value?.stage === stageValue
}

function submitClosedSearch() {
  router.get('/pharmacy/queue', {
    closed_search: searchInput.value,
    closed_page: 1,
    queued_page: props.queued.meta.current_page,
    progress_page: props.inProgress.meta.current_page,
    partially_dispensed_page: props.partiallyDispensed.meta.current_page,
  }, { preserveScroll: true })
}

function clearClosedSearch() {
  searchInput.value = ''
  router.get('/pharmacy/queue', {}, { preserveScroll: true })
}

function closedListUrl(page: number) {
  const params = new URLSearchParams()
  params.set('queued_page', String(props.queued.meta.current_page))
  params.set('progress_page', String(props.inProgress.meta.current_page))
  params.set('partially_dispensed_page', String(props.partiallyDispensed.meta.current_page))
  params.set('closed_page', String(page))
  if (props.closedSearch) params.set('closed_search', props.closedSearch)
  return `/pharmacy/queue?${params.toString()}`
}

function submitReopen(row: ClosedRow, stage: { value: string; label: string }) {
  if (!row.can_reopen) return
  const draft = reopenDraft(row)
  const reason = draft.reason.trim()
  if (!reason) {
    window.alert('Enter a reason before reopening.')
    return
  }
  if (
    !window.confirm(
      `Reopen encounter ${row.encounter_number} and queue the patient to ${stage.label}?`
    )
  ) {
    return
  }
  reopeningTarget.value = { encounterId: row.id, stage: stage.value }
  runReopen(row.id, ({ done }) => {
    router.post(
      `/encounters/${row.id}/reopen-to-stage`,
      {
        target_stage: stage.value,
        reason,
      },
      {
        preserveScroll: true,
        onFinish: () => {
          reopeningTarget.value = null
          done()
        },
      }
    )
  })
}

function prescriptionSegments(row: Row) {
  return [
    row.prescription_number ?? 'N/A',
    `${row.prescription_item_count} item${row.prescription_item_count === 1 ? '' : 's'}`,
  ]
}

function partialPrescriptionSegments(row: Row) {
  return [
    row.prescription_number ?? 'N/A',
    `${row.dispensed_item_count} of ${row.prescription_item_count} dispensed`,
  ]
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('closed_search') || params.has('closed_page')) tab.value = 'closed'
  else if (params.has('partially_dispensed_page')) tab.value = 'partially_dispensed'
})
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Pharmacy Queue</span>
    </template>

    <QueuePageShell
      title="Pharmacy Queue"
      description="Dispense prescriptions, queue patients to treatment room or back to screening, and reopen closed encounters when needed."
      :tab="tab"
      :queued-total="queued.meta.total"
      :in-progress-total="inProgress.meta.total"
      :partially-dispensed-total="partiallyDispensed.meta.total"
      :closed-total="closedEncounters.meta.total"
      waiting-label="Awaiting dispensing"
      partially-dispensed-label="Partially dispensed"
      closed-label="Closed today / reopen"
      :is-registration-clerk="isRegistrationClerk"
      @update:tab="tab = $event"
    >
      <div v-show="tab === 'waiting'" class="space-y-3">
        <QueueEmptyState v-if="queued.data.length === 0" title="Nothing awaiting dispensing" description="Encounters appear here when screening review sends prescriptions to pharmacy." />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Prescription</th>
                <th>Sent by</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in queued.data" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  time-prefix="Queued"
                  :time-relative="row.updated_at_relative"
                  :priority="row.priority"
                />
              </td>
              <td>
                <QueuePatientCell :patient-name="row.patient_name" name-fallback="Unknown" />
              </td>
              <td><div class="queue-cell-sub">{{ row.diagnosis }}</div></td>
              <td>
                <QueueInlineCell :segments="prescriptionSegments(row)" :emphasize-first="false" />
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.sent_by_name }}</div></td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueReceiveButton v-else :processing="receivingId === row.id" @click="receive('/pharmacy/:id/receive', row.id)" />
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="queued.meta"
            :previous-href="queued.meta.current_page > 1 ? queueUrl('queued_page', queued.meta.current_page - 1, listPaginationProps()) : null"
            :next-href="queued.meta.current_page < queued.meta.last_page ? queueUrl('queued_page', queued.meta.current_page + 1, listPaginationProps()) : null"
          />
        </template>
      </div>

      <div v-show="tab === 'progress'" class="space-y-3">
        <QueueEmptyState v-if="inProgress.data.length === 0" title="Nothing in progress" description="Receive a patient from the waiting queue to begin dispensing." />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Prescription</th>
                <th>Assigned to</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in inProgress.data" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  time-prefix="In progress"
                  :time-relative="row.updated_at_relative"
                  :priority="row.priority"
                />
              </td>
              <td>
                <QueuePatientCell :patient-name="row.patient_name" name-fallback="Unknown" />
              </td>
              <td><div class="queue-cell-sub">{{ row.diagnosis }}</div></td>
              <td>
                <QueueInlineCell :segments="prescriptionSegments(row)" :emphasize-first="false" />
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.received_by_name || 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueRecordButton v-else-if="row.can_manage" :href="`/pharmacy/${row.id}`" label="Open" />
                <span v-else class="queue-assigned">Assigned to {{ row.received_by_name || 'another user' }}</span>
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="inProgress.meta"
            :previous-href="inProgress.meta.current_page > 1 ? queueUrl('progress_page', inProgress.meta.current_page - 1, listPaginationProps()) : null"
            :next-href="inProgress.meta.current_page < inProgress.meta.last_page ? queueUrl('progress_page', inProgress.meta.current_page + 1, listPaginationProps()) : null"
          />
        </template>
      </div>

      <div v-show="tab === 'partially_dispensed'" class="space-y-3">
        <QueueEmptyState
          v-if="partiallyDispensed.data.length === 0"
          title="Nothing partially dispensed"
          description="Encounters with some medications dispensed but more items remaining appear here, including patients already queued to treatment room."
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Prescription</th>
                <th>Location</th>
                <th>Assigned to</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in partiallyDispensed.data" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  time-prefix="Partially dispensed"
                  :time-relative="row.updated_at_relative"
                  :priority="row.priority"
                />
              </td>
              <td>
                <QueuePatientCell :patient-name="row.patient_name" name-fallback="Unknown" />
              </td>
              <td><div class="queue-cell-sub">{{ row.diagnosis }}</div></td>
              <td>
                <QueueInlineCell :segments="partialPrescriptionSegments(row)" :emphasize-first="false" />
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.location_label ?? 'Pharmacy' }}</div></td>
              <td><div class="queue-cell-sub font-medium">{{ row.received_by_name || 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueRecordButton v-else :href="`/pharmacy/${row.id}`" label="Open" />
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="partiallyDispensed.meta"
            :previous-href="partiallyDispensed.meta.current_page > 1 ? queueUrl('partially_dispensed_page', partiallyDispensed.meta.current_page - 1, listPaginationProps()) : null"
            :next-href="partiallyDispensed.meta.current_page < partiallyDispensed.meta.last_page ? queueUrl('partially_dispensed_page', partiallyDispensed.meta.current_page + 1, listPaginationProps()) : null"
          />
        </template>
      </div>

      <div v-show="tab === 'closed'" class="space-y-3">
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="submitClosedSearch">
            <div class="min-w-[260px] flex-1">
              <label class="queue-search-label">Search closed encounters</label>
              <input v-model="searchInput" type="search" class="queue-search-input !max-w-none !pl-3" placeholder="Encounter #, patient name or ID" />
            </div>
            <button type="submit" class="queue-btn queue-btn--primary">Search</button>
            <button v-if="closedSearch" type="button" class="queue-pagination-btn" @click="clearClosedSearch">Clear</button>
        </form>

        <div
          class="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100"
          role="note"
        >
          <svg class="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="min-w-0 space-y-1">
            <p class="font-semibold">Tip — reopening closed encounters</p>
            <p class="text-xs leading-relaxed text-sky-900/90 dark:text-sky-100/90">
              This list shows only encounters <strong>closed today</strong>. You can reopen and re-queue a visit to
              <strong>any department</strong> only if it ran for
              <strong>12 hours or less</strong> (from registration start to close). Longer visits stay visible for reference but cannot be reopened.
            </p>
          </div>
        </div>

        <QueueEmptyState
          v-if="closedEncounters.data.length === 0"
          title="No closed encounters today"
          :description="closedSearch ? 'No closed encounters from today match your search.' : 'Encounters closed today appear here. Reopen is only available within 12 hours of visit start.'"
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Closed</th>
                <th class="text-right">Reopen &amp; queue to</th>
              </tr>
            </template>
            <tr v-for="row in closedEncounters.data" :key="row.id">
              <td>
                <div class="queue-cell-inline">
                  <span class="queue-cell-main">{{ row.encounter_number }}</span>
                  <EncounterBadge
                    v-if="shouldShowPriorityBadge(row.priority)"
                    type="priority"
                    :value="row.priority ?? 'normal'"
                    class="queue-cell-inline-badge"
                  />
                </div>
              </td>
              <td>
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :subtitle="row.patient_code"
                  name-fallback="Unknown"
                />
              </td>
              <td>
                <QueueInlineCell
                  :segments="[row.closed_at ?? '—', row.closed_by_name ? `by ${row.closed_by_name}` : null]"
                  :emphasize-first="false"
                />
              </td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <div v-else class="flex flex-col items-end gap-1.5">
                  <input
                    v-model="reopenDraft(row).reason"
                    type="text"
                    :disabled="!row.can_reopen || reopeningId === row.id"
                    :required="row.can_reopen"
                    maxlength="500"
                    class="queue-search-input !w-full !max-w-xs !py-1.5 !pl-2 text-xs"
                    placeholder="Reason for reopening"
                  />
                  <div class="inline-flex max-w-xs flex-wrap items-center justify-end gap-1.5">
                    <ActionButton
                      v-for="stage in reopenStages"
                      :key="stage.value"
                      variant="outline"
                      class="!min-h-0 !px-2 !py-1 text-xs"
                      :disabled="!row.can_reopen || (reopeningId === row.id && !isReopeningTo(row, stage.value))"
                      :loading="isReopeningTo(row, stage.value)"
                      loading-text="…"
                      @click="submitReopen(row, stage)"
                    >
                      {{ stage.label }}
                    </ActionButton>
                  </div>
                  <p
                    v-if="!row.can_reopen && row.reopen_blocked_reason"
                    class="queue-readonly max-w-xs text-right text-xs leading-snug"
                  >
                    {{ row.reopen_blocked_reason }}
                  </p>
                </div>
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="closedEncounters.meta"
            :previous-href="closedEncounters.meta.current_page > 1 ? closedListUrl(closedEncounters.meta.current_page - 1) : null"
            :next-href="closedEncounters.meta.current_page < closedEncounters.meta.last_page ? closedListUrl(closedEncounters.meta.current_page + 1) : null"
          />
        </template>
      </div>
    </QueuePageShell>
  </StaffLayout>
</template>
