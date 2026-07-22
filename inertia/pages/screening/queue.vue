<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { computed, onMounted, ref } from 'vue'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ReturnedChip from '~/components/encounter/ReturnedChip.vue'
import QueuePageShell from '~/components/staff/queue/QueuePageShell.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueSearchField from '~/components/staff/queue/QueueSearchField.vue'
import QueueReceiveButton from '~/components/staff/queue/QueueReceiveButton.vue'
import QueueRecordButton from '~/components/staff/queue/QueueRecordButton.vue'
import QueueEncounterCell from '~/components/staff/queue/QueueEncounterCell.vue'
import QueuePatientCell from '~/components/staff/queue/QueuePatientCell.vue'
import { useStageQueue, type QueuePaginatorMeta } from '~/composables/useStageQueue'

type Row = {
  id: number
  encounter_number: string
  patient_name: string | null
  patient_code: string | null
  patient_barcode: string | null
  visit_type: string | null
  priority: string | null
  updated_at_relative: string | null
  has_allergies: boolean
  can_manage: boolean
  patient_age: number | null
  is_returned_from_pharmacy: boolean
  return_reason: string | null
  returned_by_name: string | null
  assessment_summary: string | null
}

type Paginator = { data: Row[]; meta: QueuePaginatorMeta }
type Category = 'adult' | 'pediatric'

const props = defineProps<{
  cat: Category
  isQueuePreview: boolean
  counts: { adult: number; pediatric: number }
  queues: Record<Category, { queued: Paginator; inProgress: Paginator }>
}>()

const { tab, receivingId, receive } = useStageQueue('/screening/queue', {
  pollOnly: ['queues', 'counts'],
})

const activeCat = ref<Category>(props.cat)
const barcodeSearch = ref('')

const queued = computed(() => props.queues[activeCat.value].queued)
const inProgress = computed(() => props.queues[activeCat.value].inProgress)

function switchCategory(nextCat: Category) {
  if (activeCat.value === nextCat) {
    return
  }

  activeCat.value = nextCat

  const url = new URL(window.location.href)
  url.searchParams.set('cat', nextCat)
  window.history.replaceState(window.history.state, '', url.toString())
}

function matchesRow(row: Row) {
  const q = barcodeSearch.value.trim().toLowerCase()
  if (!q) return true
  return (
    (row.patient_barcode ?? '').toLowerCase().includes(q) ||
    (row.patient_code ?? '').toLowerCase().includes(q)
  )
}

function patientDetails(row: Row) {
  return [
    row.patient_age !== null ? `${row.patient_age} y/o` : null,
    row.patient_code,
  ]
    .filter(Boolean)
    .join(' · ')
}

const visibleQueued = computed(() => queued.value.data.filter(matchesRow))
const visibleInProgress = computed(() => inProgress.value.data.filter(matchesRow))

function queuePageUrl(pageParam: 'queued_page' | 'progress_page', page: number) {
  const params = new URLSearchParams(window.location.search)
  params.set('queued_page', String(pageParam === 'queued_page' ? page : queued.value.meta.current_page))
  params.set(
    'progress_page',
    String(pageParam === 'progress_page' ? page : inProgress.value.meta.current_page)
  )
  params.set('cat', activeCat.value)
  return `/screening/queue?${params.toString()}`
}

function navigateQueuePage(pageParam: 'queued_page' | 'progress_page', page: number) {
  router.get(
    queuePageUrl(pageParam, page),
    {},
    {
      only: ['queues', 'counts'],
      preserveScroll: true,
      preserveState: true,
      showProgress: false,
    }
  )
}

onMounted(() => {
  barcodeSearch.value = new URLSearchParams(window.location.search).get('barcode') ?? ''
})
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Screening Queue</span>
    </template>

    <QueuePageShell
      title="Screening Queue"
      description="Initial clinical assessment after triage. Filter by patient category and scan barcodes to find encounters quickly."
      :tab="tab"
      :queued-total="queued.meta.total"
      :in-progress-total="inProgress.meta.total"
      :is-queue-preview="isQueuePreview"
      @update:tab="tab = $event"
    >
      <template #categories>
        <div class="queue-category-tabs">
          <button
            type="button"
            class="queue-category-tab"
            :class="{ active: activeCat === 'adult' }"
            @click="switchCategory('adult')"
          >
            Adult <span class="queue-category-count">{{ counts.adult }}</span>
          </button>
          <button
            type="button"
            class="queue-category-tab"
            :class="{ active: activeCat === 'pediatric' }"
            @click="switchCategory('pediatric')"
          >
            Pediatric (under 5) <span class="queue-category-count">{{ counts.pediatric }}</span>
          </button>
        </div>
      </template>

      <template #toolbar>
        <QueueSearchField
          v-model="barcodeSearch"
          label="Barcode / Patient ID"
          placeholder="Scan barcode or type patient ID…"
          :hint="barcodeSearch.trim() ? `Filtering queue by ${barcodeSearch}` : undefined"
        />
      </template>

      <div v-show="tab === 'waiting'" class="space-y-3">
        <QueueEmptyState
          v-if="visibleQueued.length === 0"
          title="No patients waiting"
          :description="`No ${activeCat} patients waiting. Patients arrive here after triage completes their assessment.`"
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Clinical flags</th>
                <th>Returned by</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in visibleQueued" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  time-prefix="Arrived"
                  :time-relative="row.updated_at_relative"
                  :priority="row.priority"
                  :encounter-id="row.id"
                  :can-change-priority="!isQueuePreview"
                >
                  <ReturnedChip v-if="row.is_returned_from_pharmacy" />
                </QueueEncounterCell>
              </td>
              <td>
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :visit-type="row.visit_type"
                  :details="patientDetails(row)"
                />
              </td>
              <td>
                <div class="flex flex-wrap items-center gap-2">
                  <span v-if="row.has_allergies" class="queue-chip queue-chip--warning">Allergies noted</span>
                  <span v-if="row.return_reason" class="queue-cell-sub">{{ row.return_reason }}</span>
                  <span v-if="!row.has_allergies && !row.return_reason" class="queue-cell-sub">No clinical flags</span>
                </div>
              </td>
              <td>
                <div class="queue-cell-sub font-medium">
                  {{ row.is_returned_from_pharmacy ? (row.returned_by_name ?? 'Unknown user') : '—' }}
                </div>
              </td>
              <td class="queue-action-col">
                <span v-if="isQueuePreview" class="queue-readonly">Read only</span>
                <QueueReceiveButton v-else :processing="receivingId === row.id" @click="receive('/screening/:id/receive', row.id)" />
              </td>
            </tr>
          </QueueTable>
          <nav
            v-if="queued.meta.last_page > 1"
            class="queue-pagination"
            aria-label="Queue pagination"
          >
            <button
              v-if="queued.meta.current_page > 1"
              type="button"
              class="queue-pagination-btn"
              @click="navigateQueuePage('queued_page', queued.meta.current_page - 1)"
            >
              Previous
            </button>
            <span class="queue-pagination-label">Page {{ queued.meta.current_page }} of {{ queued.meta.last_page }}</span>
            <button
              v-if="queued.meta.current_page < queued.meta.last_page"
              type="button"
              class="queue-pagination-btn"
              @click="navigateQueuePage('queued_page', queued.meta.current_page + 1)"
            >
              Next
            </button>
          </nav>
        </template>
      </div>

      <div v-show="tab === 'progress'" class="space-y-3">
        <QueueEmptyState
          v-if="visibleInProgress.length === 0"
          title="Nothing in progress"
          :description="`No ${activeCat} patients are currently being screened.`"
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Assessment</th>
                <th>Returned by</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in visibleInProgress" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  time-prefix="In progress"
                  :time-relative="row.updated_at_relative"
                  :priority="row.priority"
                  :encounter-id="row.id"
                  :can-change-priority="!isQueuePreview"
                >
                  <ReturnedChip v-if="row.is_returned_from_pharmacy" />
                </QueueEncounterCell>
              </td>
              <td>
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :visit-type="row.visit_type"
                  :details="patientDetails(row)"
                />
              </td>
              <td><div class="queue-cell-sub">{{ row.assessment_summary ?? 'Assessment started' }}</div></td>
              <td>
                <div class="queue-cell-sub font-medium">
                  {{ row.is_returned_from_pharmacy ? (row.returned_by_name ?? 'Unknown user') : '—' }}
                </div>
              </td>
              <td class="queue-action-col">
                <span v-if="isQueuePreview" class="queue-readonly">Read only</span>
                <QueueRecordButton v-else-if="row.can_manage" :href="`/screening/${row.id}`" label="Continue" />
                <span v-else class="queue-assigned">Assigned to another user</span>
              </td>
            </tr>
          </QueueTable>
          <nav
            v-if="inProgress.meta.last_page > 1"
            class="queue-pagination"
            aria-label="Queue pagination"
          >
            <button
              v-if="inProgress.meta.current_page > 1"
              type="button"
              class="queue-pagination-btn"
              @click="navigateQueuePage('progress_page', inProgress.meta.current_page - 1)"
            >
              Previous
            </button>
            <span class="queue-pagination-label">Page {{ inProgress.meta.current_page }} of {{ inProgress.meta.last_page }}</span>
            <button
              v-if="inProgress.meta.current_page < inProgress.meta.last_page"
              type="button"
              class="queue-pagination-btn"
              @click="navigateQueuePage('progress_page', inProgress.meta.current_page + 1)"
            >
              Next
            </button>
          </nav>
        </template>
      </div>
    </QueuePageShell>
  </StaffLayout>
</template>
