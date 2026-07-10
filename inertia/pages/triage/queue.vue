<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import QueuePageShell from '~/components/staff/queue/QueuePageShell.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueReceiveButton from '~/components/staff/queue/QueueReceiveButton.vue'
import QueueRecordButton from '~/components/staff/queue/QueueRecordButton.vue'
import QueuePagination from '~/components/staff/queue/QueuePagination.vue'
import TemperatureQueueIndicator from '~/components/staff/queue/TemperatureQueueIndicator.vue'
import QueueEncounterCell from '~/components/staff/queue/QueueEncounterCell.vue'
import QueuePatientCell from '~/components/staff/queue/QueuePatientCell.vue'
import { useLiveQueueRefresh } from '~/composables/useLiveQueueRefresh'

type Row = {
  id: number
  encounter_number: string
  patient_name: string | null
  visit_type: string | null
  priority: string | null
  updated_at_relative: string | null
  queued_by_name: string | null
  received_by_name: string | null
  has_allergies: boolean
  can_manage: boolean
  temperature: number | null
}

type Paginator = {
  data: Row[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

const props = defineProps<{
  isRegistrationClerk: boolean
  queued: Paginator
  inProgress: Paginator
}>()

const tab = ref<'waiting' | 'progress'>('waiting')
const receivingId = ref<number | null>(null)

useLiveQueueRefresh({
  stages: ['triage'],
  only: ['queued', 'inProgress'],
})

function queueUrl(pageParam: 'queued_page' | 'progress_page', page: number) {
  const params = new URLSearchParams()
  params.set('queued_page', String(pageParam === 'queued_page' ? page : props.queued.meta.current_page))
  params.set('progress_page', String(pageParam === 'progress_page' ? page : props.inProgress.meta.current_page))
  return `/triage/queue?${params.toString()}`
}

function receive(id: number) {
  receivingId.value = id
  router.post(`/triage/${id}/receive`, {}, { onFinish: () => { receivingId.value = null } })
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Triage Queue</span>
    </template>

    <QueuePageShell
      title="Triage Queue"
      description="Receive patients from registration, record vitals and startup medications, then queue them to screening."
      :tab="tab"
      :queued-total="queued.meta.total"
      :in-progress-total="inProgress.meta.total"
      :is-registration-clerk="isRegistrationClerk"
      @update:tab="tab = $event"
    >
      <div v-show="tab === 'waiting'" class="space-y-3">
        <QueueEmptyState
          v-if="queued.data.length === 0"
          title="No patients waiting"
          description="Patients appear here after registration queues them to triage."
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Clinical flags</th>
                <th>Queued by</th>
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
                <QueuePatientCell :patient-name="row.patient_name" :visit-type="row.visit_type" />
              </td>
              <td>
                <div class="flex flex-wrap items-center gap-2">
                  <span v-if="row.has_allergies" class="queue-chip queue-chip--warning">Allergies noted</span>
                  <TemperatureQueueIndicator :temperature="row.temperature" hide-when-missing />
                  <span
                    v-if="!row.has_allergies && row.temperature === null"
                    class="queue-cell-sub"
                  >
                    No clinical flags
                  </span>
                </div>
              </td>
              <td><div class="queue-cell-sub font-medium text-neutral-700 dark:text-neutral-300">{{ row.queued_by_name ?? 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueReceiveButton v-else :processing="receivingId === row.id" @click="receive(row.id)" />
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="queued.meta"
            :previous-href="queued.meta.current_page > 1 ? queueUrl('queued_page', queued.meta.current_page - 1) : null"
            :next-href="queued.meta.current_page < queued.meta.last_page ? queueUrl('queued_page', queued.meta.current_page + 1) : null"
          />
        </template>
      </div>

      <div v-show="tab === 'progress'" class="space-y-3">
        <QueueEmptyState
          v-if="inProgress.data.length === 0"
          title="Nothing in progress"
          :description="isRegistrationClerk ? 'No patients are currently in triage.' : 'Receive a patient from the waiting queue to begin recording vitals.'"
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Temperature</th>
                <th>Assigned to</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in inProgress.data" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  time-prefix="Received"
                  :time-relative="row.updated_at_relative"
                  :priority="row.priority"
                />
              </td>
              <td>
                <QueuePatientCell :patient-name="row.patient_name" :visit-type="row.visit_type" />
              </td>
              <td>
                <TemperatureQueueIndicator :temperature="row.temperature" />
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.received_by_name || 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueRecordButton v-else-if="row.can_manage" :href="`/triage/${row.id}`" label="Record" />
                <span v-else class="queue-assigned">Assigned to {{ row.received_by_name || 'another user' }}</span>
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="inProgress.meta"
            :previous-href="inProgress.meta.current_page > 1 ? queueUrl('progress_page', inProgress.meta.current_page - 1) : null"
            :next-href="inProgress.meta.current_page < inProgress.meta.last_page ? queueUrl('progress_page', inProgress.meta.current_page + 1) : null"
          />
        </template>
      </div>
    </QueuePageShell>
  </StaffLayout>
</template>
