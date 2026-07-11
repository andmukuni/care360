<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import QueuePageShell from '~/components/staff/queue/QueuePageShell.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueSearchField from '~/components/staff/queue/QueueSearchField.vue'
import QueuePatientCell from '~/components/staff/queue/QueuePatientCell.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'

interface Registration {
  id: number
  patientNumber: string
  fullName: string
  email: string | null
  phoneNumber: string | null
  gender: string | null
  status: string
  updatedAt: string | null
  updatedAtFormatted: string | null
  updatedAtRelative: string | null
}

const props = defineProps<{
  registrations: Registration[]
  pendingCount: number
}>()

const search = ref('')
const { processingId, runFor } = useAsyncAction<string>()

const filteredRegistrations = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.registrations

  return props.registrations.filter((r) => {
    const haystack = [r.fullName, r.patientNumber, r.email, r.phoneNumber, r.gender]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function display(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  return text === '' ? '—' : text
}

function openPatient(patientNumber: string, event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('a, button, input, select, textarea, label')) return
  router.visit(`/patients/${patientNumber}`)
}

function approve(r: Registration) {
  if (!confirm(`Approve portal access for ${r.fullName}?`)) return
  runFor(`${r.id}-approve`, ({ done }) => {
    router.post(`/portal-registrations/${r.patientNumber}/approve`, {}, { onFinish: done })
  })
}

function decline(r: Registration) {
  if (!confirm(`Decline ${r.fullName}'s portal sign-up? Their portal password will be cleared.`)) return
  runFor(`${r.id}-decline`, ({ done }) => {
    router.post(`/portal-registrations/${r.patientNumber}/decline`, {}, { onFinish: done })
  })
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Portal Registrations</span>
    </template>

    <QueuePageShell
      title="Pending KYC"
      description="Patients who self-registered via the mobile app and are awaiting staff approval. Review their details, then approve to grant portal access or decline to block the sign-up."
      :show-live-indicator="false"
    >
      <div class="queue-stat-row">
        <div class="queue-stat">
          <span class="queue-stat-label">Awaiting Approval</span>
          <span class="queue-stat-value">{{ formatNumber(pendingCount) }}</span>
        </div>
        <div class="queue-stat">
          <span class="queue-stat-label">Showing</span>
          <span class="queue-stat-value">{{ formatNumber(filteredRegistrations.length) }}</span>
        </div>
      </div>

      <template #toolbar>
        <QueueSearchField
          v-model="search"
          label="Search registrations"
          placeholder="Search by name, patient ID, email, or phone…"
          :hint="search.trim() ? `${filteredRegistrations.length} of ${registrations.length} shown` : undefined"
        />
      </template>

      <div class="space-y-3">
        <QueueEmptyState
          v-if="filteredRegistrations.length === 0"
          :title="search.trim() ? 'No matching registrations' : 'No sign-ups awaiting approval'"
          :description="
            search.trim()
              ? 'Try a different search term.'
              : 'New portal self-registrations will appear here for KYC review.'
          "
        />

        <QueueTable v-else>
          <template #head>
            <tr>
              <th>Patient</th>
              <th>Contact</th>
              <th>Signed Up</th>
              <th class="text-right">Action</th>
            </tr>
          </template>

          <tr
            v-for="row in filteredRegistrations"
            :key="row.id"
            class="cursor-pointer"
            @click="openPatient(row.patientNumber, $event)"
          >
            <td>
              <QueuePatientCell
                :patient-name="row.fullName"
                :details="row.patientNumber"
                :subtitle="row.gender"
              />
            </td>
            <td>
              <div class="queue-cell-inline">
                <span class="queue-cell-main">{{ display(row.email) }}</span>
                <template v-if="row.phoneNumber">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.phoneNumber }}</span>
                </template>
              </div>
            </td>
            <td>
              <div v-if="row.updatedAtFormatted" class="queue-cell-inline">
                <span class="queue-cell-main">{{ row.updatedAtFormatted }}</span>
                <template v-if="row.updatedAtRelative">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.updatedAtRelative }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td class="queue-action-col">
              <div class="queue-table-action-group">
                <button
                  type="button"
                  class="queue-icon-btn queue-icon-btn--primary"
                  title="Approve portal access"
                  aria-label="Approve portal access"
                  :disabled="processingId === `${row.id}-approve` || processingId === `${row.id}-decline`"
                  @click.stop="approve(row)"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="queue-icon-btn queue-icon-btn--danger"
                  title="Decline sign-up"
                  aria-label="Decline sign-up"
                  :disabled="processingId === `${row.id}-approve` || processingId === `${row.id}-decline`"
                  @click.stop="decline(row)"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </QueueTable>
      </div>
    </QueuePageShell>
  </StaffLayout>
</template>
