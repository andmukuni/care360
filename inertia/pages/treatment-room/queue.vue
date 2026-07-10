<script setup lang="ts">
import StaffLayout from '~/layouts/StaffLayout.vue'
import QueuePageShell from '~/components/staff/queue/QueuePageShell.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueReceiveButton from '~/components/staff/queue/QueueReceiveButton.vue'
import QueueRecordButton from '~/components/staff/queue/QueueRecordButton.vue'
import QueuePagination from '~/components/staff/queue/QueuePagination.vue'
import QueueEncounterCell from '~/components/staff/queue/QueueEncounterCell.vue'
import QueuePatientCell from '~/components/staff/queue/QueuePatientCell.vue'
import { useStageQueue, type QueuePaginatorMeta } from '~/composables/useStageQueue'

type MedicationChip = { drug_name: string; route: string | null }

type Row = {
  id: number
  encounter_number: string
  patient_name: string | null
  patient_code: string | null
  priority: string | null
  updated_at_relative: string | null
  received_by_name: string | null
  can_manage: boolean
  source_label: string
  sent_by_name: string
  transition_notes: string | null
  dispensed_medications: MedicationChip[]
  show_priority_badge: boolean
}

type Paginator = { data: Row[]; meta: QueuePaginatorMeta }

const props = defineProps<{
  isRegistrationClerk: boolean
  queued: Paginator
  inProgress: Paginator
}>()

const { tab, receivingId, queueUrl, receive } = useStageQueue('/treatment-room/queue')

function routeChipClass(route: string | null) {
  const normalized = String(route ?? '').toUpperCase()
  if (['IV', 'IV PUSH', 'IV DRIP'].includes(normalized)) return 'route-iv'
  if (normalized === 'IM') return 'route-im'
  if (normalized === 'SC') return 'route-sc'
  return ''
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Treatment Room</span>
    </template>

    <QueuePageShell
      title="Treatment Room Queue"
      description="Receive patients with dispensed medications, administer treatment, and close encounters when complete."
      :tab="tab"
      :queued-total="queued.meta.total"
      :in-progress-total="inProgress.meta.total"
      waiting-label="Awaiting reception"
      theme="treatment"
      :is-registration-clerk="isRegistrationClerk"
      @update:tab="tab = $event"
    >
      <div v-show="tab === 'waiting'" class="space-y-3">
        <QueueEmptyState v-if="queued.data.length === 0" title="No patients waiting" description="Patients arrive here from pharmacy or screening with dispensed medications." />
        <template v-else>
          <QueueTable theme="treatment">
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Medications</th>
                <th>Handover</th>
                <th class="text-right">Action</th>
              </tr>
            </template>
            <tr v-for="row in queued.data" :key="row.id">
              <td>
                <QueueEncounterCell
                  :encounter-number="row.encounter_number"
                  :time-prefix="row.source_label"
                  :time-relative="row.updated_at_relative"
                  :extra="`Sent by ${row.sent_by_name}`"
                  :priority="row.priority"
                />
              </td>
              <td>
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :subtitle="row.patient_code"
                  name-fallback="Unknown"
                />
              </td>
              <td>
                <span v-if="row.dispensed_medications.length === 0" class="queue-cell-sub italic">None recorded</span>
                <div v-else class="queue-cell-inline">
                  <span
                    v-for="(med, index) in row.dispensed_medications"
                    :key="`${row.id}-${index}`"
                    class="drug-chip"
                    :class="routeChipClass(med.route)"
                  >
                    {{ med.drug_name }}<template v-if="med.route"> ({{ med.route }})</template>
                  </span>
                </div>
              </td>
              <td><div class="queue-cell-sub">{{ row.transition_notes || '—' }}</div></td>
              <td class="queue-action-col">
                <QueueReceiveButton theme="treatment" label="Receive" :processing="receivingId === row.id" @click="receive('/treatment-room/:id/receive', row.id)" />
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
        <QueueEmptyState v-if="inProgress.data.length === 0" title="Nothing in progress" description="Receive a patient to begin treatment room documentation." />
        <template v-else>
          <QueueTable theme="treatment">
            <template #head>
              <tr>
                <th>Encounter</th>
                <th>Patient</th>
                <th>Medications</th>
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
                />
              </td>
              <td>
                <QueuePatientCell
                  :patient-name="row.patient_name"
                  :subtitle="row.patient_code"
                  name-fallback="Unknown"
                />
              </td>
              <td>
                <div class="queue-cell-inline">
                  <span
                    v-for="(med, index) in row.dispensed_medications"
                    :key="`${row.id}-${index}`"
                    class="drug-chip"
                    :class="routeChipClass(med.route)"
                  >
                    {{ med.drug_name }}<template v-if="med.route"> ({{ med.route }})</template>
                  </span>
                </div>
              </td>
              <td><div class="queue-cell-sub font-medium">{{ row.received_by_name ?? '—' }}</div></td>
              <td class="queue-action-col">
                <QueueRecordButton v-if="row.can_manage" :href="`/treatment-room/${row.id}`" label="Open" theme="treatment" />
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
