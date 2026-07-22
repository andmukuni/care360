<script setup lang="ts">
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
import { useStageQueue, type QueuePaginatorMeta } from '~/composables/useStageQueue'

type Row = {
  id: number
  encounter_number: string
  patient_name: string | null
  priority: string | null
  updated_at_relative: string | null
  queued_by_name: string | null
  received_by_name: string | null
  can_manage: boolean
  lab_request_number: string | null
  lab_priority: string | null
  test_count: number
}

type Paginator = { data: Row[]; meta: QueuePaginatorMeta }

const props = defineProps<{
  isQueuePreview: boolean
  queued: Paginator
  inProgress: Paginator
}>()

const { tab, receivingId, queueUrl, receive } = useStageQueue('/lab/queue')

function labRequestSegments(row: Row) {
  if (!row.lab_request_number) {
    return []
  }

  return [
    row.lab_request_number,
    row.test_count > 0 ? `${row.test_count} test${row.test_count === 1 ? '' : 's'}` : null,
  ]
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Lab Queue</span>
    </template>

    <QueuePageShell
      title="Lab Queue"
      description="Receive patients with pending lab requests, record samples and results, then return them to screening review."
      :tab="tab"
      :queued-total="queued.meta.total"
      :in-progress-total="inProgress.meta.total"
      :is-queue-preview="isQueuePreview"
      @update:tab="tab = $event"
    >
      <div v-show="tab === 'waiting'" class="space-y-3">
        <QueueEmptyState v-if="queued.data.length === 0" title="No patients waiting" description="Lab receives patients when screening requests tests." />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Lab request</th>
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
                  :encounter-id="row.id"
                  :can-change-priority="!isQueuePreview"
                />
              </td>
              <td>
                <QueuePatientCell :patient-name="row.patient_name" />
              </td>
              <td>
                <div v-if="row.lab_request_number" class="queue-cell-inline">
                  <QueueInlineCell :segments="labRequestSegments(row)" :emphasize-first="false" />
                  <EncounterBadge
                    v-if="shouldShowPriorityBadge(row.lab_priority)"
                    type="priority"
                    :value="row.lab_priority ?? 'normal'"
                    class="queue-cell-inline-badge"
                  />
                </div>
                <span v-else class="queue-cell-sub">Details after receive</span>
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.queued_by_name ?? 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isQueuePreview" class="queue-readonly">Read only</span>
                <QueueReceiveButton v-else :processing="receivingId === row.id" @click="receive('/lab/:id/receive', row.id)" />
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="queued.meta"
            :previous-href="queued.meta.current_page > 1 ? queueUrl('queued_page', queued.meta.current_page - 1, props) : null"
            :next-href="queued.meta.current_page < queued.meta.last_page ? queueUrl('queued_page', queued.meta.current_page + 1, props) : null"
          />
        </template>
      </div>

      <div v-show="tab === 'progress'" class="space-y-3">
        <QueueEmptyState
          v-if="inProgress.data.length === 0"
          title="Nothing in progress"
          :description="isQueuePreview ? 'No patients are currently in lab.' : 'Receive a patient from the waiting queue to begin.'"
        />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Lab request</th>
                <th>Received by</th>
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
                  :encounter-id="row.id"
                  :can-change-priority="!isQueuePreview"
                />
              </td>
              <td>
                <QueuePatientCell :patient-name="row.patient_name" />
              </td>
              <td>
                <QueueInlineCell
                  v-if="row.lab_request_number"
                  :segments="labRequestSegments(row)"
                  :emphasize-first="false"
                />
                <span v-else class="queue-cell-sub">N/A</span>
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.received_by_name || 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isQueuePreview" class="queue-readonly">Read only</span>
                <QueueRecordButton v-else-if="row.can_manage" :href="`/lab/${row.id}`" label="Record" />
                <span v-else class="queue-assigned">Assigned to {{ row.received_by_name || 'another user' }}</span>
              </td>
            </tr>
          </QueueTable>
          <QueuePagination
            :meta="inProgress.meta"
            :previous-href="inProgress.meta.current_page > 1 ? queueUrl('progress_page', inProgress.meta.current_page - 1, props) : null"
            :next-href="inProgress.meta.current_page < inProgress.meta.last_page ? queueUrl('progress_page', inProgress.meta.current_page + 1, props) : null"
          />
        </template>
      </div>
    </QueuePageShell>
  </StaffLayout>
</template>
