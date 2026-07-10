<script setup lang="ts">
import StaffLayout from '~/layouts/StaffLayout.vue'
import ReturnedChip from '~/components/encounter/ReturnedChip.vue'
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
  visit_type: string | null
  priority: string | null
  updated_at_relative: string | null
  received_by_name: string | null
  has_allergies: boolean
  can_manage: boolean
  patient_age: number | null
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

type Paginator = { data: Row[]; meta: QueuePaginatorMeta }

const props = defineProps<{
  isRegistrationClerk: boolean
  queued: Paginator
  inProgress: Paginator
}>()

const { tab, receivingId, queueUrl, receive } = useStageQueue('/screening-review/queue')

function patientDetails(row: Row) {
  return row.patient_age !== null ? `${row.patient_age} y/o` : null
}

function labRequestSegments(row: Row) {
  if (!row.lab_request_number) {
    return row.screening_diagnosis ? [row.screening_diagnosis, 'Not linked'] : ['Not linked']
  }

  return [
    row.screening_diagnosis,
    `${row.lab_request_number} · ${row.test_count} test${row.test_count === 1 ? '' : 's'}`,
  ]
}

function attributionSegments(row: Row) {
  return [
    `Req: ${row.lab_requested_by || 'Unknown'}`,
    `Posted: ${row.lab_results_posted_by.length ? row.lab_results_posted_by.join(', ') : 'Unknown'}`,
  ]
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Screening Review Queue</span>
    </template>

    <QueuePageShell
      title="Screening Review Queue"
      description="Review lab results, finalize diagnosis, and send updated prescriptions to pharmacy."
      :tab="tab"
      :queued-total="queued.meta.total"
      :in-progress-total="inProgress.meta.total"
      :is-registration-clerk="isRegistrationClerk"
      @update:tab="tab = $event"
    >
      <div v-show="tab === 'waiting'" class="space-y-3">
        <QueueEmptyState v-if="queued.data.length === 0" title="No patients waiting" description="Patients appear here after lab returns results." />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Lab request</th>
                <th>Attribution</th>
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
                >
                  <ReturnedChip v-if="row.is_returned_loopback" />
                </QueueEncounterCell>
              </td>
              <td>
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :visit-type="row.visit_type"
                  visit-fallback="OPD"
                  :details="patientDetails(row)"
                />
              </td>
              <td>
                <QueueInlineCell :segments="labRequestSegments(row)" :emphasize-first="false" />
              </td>
              <td>
                <QueueInlineCell :segments="attributionSegments(row)" :emphasize-first="false" />
              </td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueReceiveButton v-else :processing="receivingId === row.id" @click="receive('/screening-review/:id/receive', row.id)" />
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
        <QueueEmptyState v-if="inProgress.data.length === 0" title="Nothing in progress" description="Receive a patient from the waiting queue to begin review." />
        <template v-else>
          <QueueTable>
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Review summary</th>
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
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :visit-type="row.visit_type"
                  visit-fallback="OPD"
                  :details="patientDetails(row)"
                />
              </td>
              <td>
                <QueueInlineCell
                  :segments="[row.review_summary ?? 'Review in progress', row.prescription_number]"
                  :emphasize-first="false"
                />
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.received_by_name || 'Unknown user' }}</div></td>
              <td class="queue-action-col">
                <span v-if="isRegistrationClerk" class="queue-readonly">Read only</span>
                <QueueRecordButton v-else-if="row.can_manage" :href="`/screening-review/${row.id}`" label="Review" />
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
