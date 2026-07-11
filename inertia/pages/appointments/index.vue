<script setup lang="ts">
import { computed, ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import QueuePageShell from '~/components/staff/queue/QueuePageShell.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueSearchField from '~/components/staff/queue/QueueSearchField.vue'
import AppointmentTabs, { type AppointmentTab } from '~/components/staff/queue/AppointmentTabs.vue'
import QueueAppointmentCell from '~/components/staff/queue/QueueAppointmentCell.vue'
import QueuePatientCell from '~/components/staff/queue/QueuePatientCell.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Patient {
  id: number
  patientNumber: string
  fullName: string
  gender: string | null
  phoneNumber: string | null
}

interface Appointment {
  id: number
  appointmentType: string
  appointmentPurpose: string | null
  reason: string | null
  status: string
  preferredDate: string | null
  preferredTime: string | null
  alternateDate: string | null
  alternateTime: string | null
  confirmedDate: string | null
  confirmedTime: string | null
  provider: string | null
  createdAtRelative: string | null
  patient: Patient | null
}

const props = defineProps<{
  tab: AppointmentTab
  pendingCount: number
  confirmedCount: number
  todayCount: number
  appointments: Appointment[]
}>()

const search = ref('')

const emptyCopy = computed(() => {
  if (props.tab === 'pending') {
    return {
      title: 'No pending requests',
      description: 'Portal appointment requests will appear here for review.',
    }
  }
  if (props.tab === 'today') {
    return {
      title: 'No appointments today',
      description: 'Confirmed appointments scheduled for today will appear here.',
    }
  }
  return {
    title: 'No upcoming appointments',
    description: 'Confirmed bookings with future dates will appear here.',
  }
})

const filteredAppointments = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.appointments

  return props.appointments.filter((a) => {
    const haystack = [
      a.patient?.fullName,
      a.patient?.patientNumber,
      a.appointmentType,
      a.appointmentPurpose,
      a.reason,
      a.provider,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(q)
  })
})

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function appointmentSubtitle(a: Appointment): string {
  const patient = a.patient?.fullName ?? '—'
  const when =
    props.tab === 'pending'
      ? [formatDate(a.preferredDate), a.preferredTime].filter((v) => v && v !== '—').join(' · ')
      : [formatDate(a.confirmedDate ?? a.preferredDate), a.confirmedTime ?? a.preferredTime]
          .filter((v) => v && v !== '—')
          .join(' · ')
  return `${patient} · ${when || '—'}`
}

function switchTab(tab: AppointmentTab) {
  router.get('/appointments', { tab }, { preserveState: false })
}

function openAppointment(id: number, event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('a, button, input, select, textarea, label')) return
  router.visit(`/appointments/${id}`)
}

// ── Confirm modal ──────────────────────────────────────────────────────────
const confirmTarget = ref<Appointment | null>(null)
const confirmForm = useForm({ confirmed_date: '', confirmed_time: '', staff_notes: '' })
function openConfirm(a: Appointment) {
  confirmTarget.value = a
  confirmForm.clearErrors()
  confirmForm.confirmed_date = a.confirmedDate ?? a.preferredDate ?? ''
  confirmForm.confirmed_time = a.confirmedTime ?? a.preferredTime ?? ''
  confirmForm.staff_notes = ''
}
function submitConfirm() {
  if (!confirmTarget.value) return
  confirmForm.put(`/appointments/${confirmTarget.value.id}/confirm`, {
    onSuccess: () => (confirmTarget.value = null),
  })
}

// ── Decline modal ────────────────────────────────────────────────────────
const declineTarget = ref<Appointment | null>(null)
const declineForm = useForm({ staff_notes: '' })
function openDecline(a: Appointment) {
  declineTarget.value = a
  declineForm.clearErrors()
  declineForm.staff_notes = ''
}
function submitDecline() {
  if (!declineTarget.value) return
  if (!window.confirm('Decline this appointment request?')) return
  declineForm.put(`/appointments/${declineTarget.value.id}/decline`, {
    onSuccess: () => (declineTarget.value = null),
  })
}

// ── Queue modal ──────────────────────────────────────────────────────────────
const queueTarget = ref<Appointment | null>(null)
const queueForm = useForm({ stage: 'triage', notes: '' })
const stages = [
  { key: 'triage', label: 'Triage' },
  { key: 'screening', label: 'Screening' },
  { key: 'lab', label: 'Lab' },
  { key: 'screening_review', label: 'Screening Review' },
  { key: 'pharmacy', label: 'Pharmacy' },
]
function openQueue(a: Appointment) {
  queueTarget.value = a
  queueForm.clearErrors()
  queueForm.stage = 'triage'
  queueForm.notes = ''
}
function submitQueue() {
  if (!queueTarget.value) return
  queueForm.post(`/appointments/${queueTarget.value.id}/queue`, {
    onSuccess: () => (queueTarget.value = null),
  })
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Appointments</span>
    </template>

    <QueuePageShell
      title="Appointments"
      description="Review portal requests and manage confirmed bookings."
      :show-live-indicator="false"
    >
      <template #tabs>
        <AppointmentTabs
          :tab="tab"
          :pending-count="pendingCount"
          :confirmed-count="confirmedCount"
          :today-count="todayCount"
          @update:tab="switchTab"
        />
      </template>

      <template #toolbar>
        <QueueSearchField
          v-model="search"
          label="Search appointments"
          placeholder="Search by patient, type, reason, or provider…"
          :hint="search.trim() ? `${filteredAppointments.length} of ${appointments.length} shown` : undefined"
        />
      </template>

      <div v-show="tab === 'pending'" class="space-y-3">
        <QueueEmptyState
          v-if="filteredAppointments.length === 0"
          :title="search.trim() ? 'No matching appointments' : emptyCopy.title"
          :description="search.trim() ? 'Try a different search term or switch tabs.' : emptyCopy.description"
        />
        <QueueTable v-else>
          <template #head>
            <tr>
              <th>Appointment</th>
              <th>Patient</th>
              <th>Preferred</th>
              <th>Alternate</th>
              <th class="text-right">Action</th>
            </tr>
          </template>
          <tr
            v-for="row in filteredAppointments"
            :key="row.id"
            class="cursor-pointer"
            @click="openAppointment(row.id, $event)"
          >
            <td>
              <QueueAppointmentCell
                :appointment-type="row.appointmentType"
                :appointment-purpose="row.appointmentPurpose"
                :created-at-relative="row.createdAtRelative"
                :reason="row.reason"
              />
            </td>
            <td>
              <QueuePatientCell
                :patient-name="row.patient?.fullName ?? null"
                :details="row.patient?.patientNumber ?? null"
              />
            </td>
            <td>
              <div v-if="row.preferredDate" class="queue-cell-inline">
                <span class="queue-cell-main">{{ formatDate(row.preferredDate) }}</span>
                <template v-if="row.preferredTime">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.preferredTime }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td>
              <div v-if="row.alternateDate" class="queue-cell-inline">
                <span class="queue-cell-main">{{ formatDate(row.alternateDate) }}</span>
                <template v-if="row.alternateTime">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.alternateTime }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td class="queue-action-col">
              <div class="queue-card-action">
                <ActionButton variant="queue" @click.stop="openConfirm(row)">Confirm</ActionButton>
                <ActionButton variant="outline" @click.stop="openDecline(row)">Decline</ActionButton>
              </div>
            </td>
          </tr>
        </QueueTable>
      </div>

      <div v-show="tab === 'confirmed'" class="space-y-3">
        <QueueEmptyState
          v-if="filteredAppointments.length === 0"
          :title="search.trim() ? 'No matching appointments' : emptyCopy.title"
          :description="search.trim() ? 'Try a different search term or switch tabs.' : emptyCopy.description"
        />
        <QueueTable v-else>
          <template #head>
            <tr>
              <th>Appointment</th>
              <th>Patient</th>
              <th>Preferred</th>
              <th>Confirmed</th>
              <th>Provider</th>
              <th class="text-right">Action</th>
            </tr>
          </template>
          <tr
            v-for="row in filteredAppointments"
            :key="row.id"
            class="cursor-pointer"
            @click="openAppointment(row.id, $event)"
          >
            <td>
              <QueueAppointmentCell
                :appointment-type="row.appointmentType"
                :appointment-purpose="row.appointmentPurpose"
                :created-at-relative="row.createdAtRelative"
                :reason="row.reason"
              />
            </td>
            <td>
              <QueuePatientCell
                :patient-name="row.patient?.fullName ?? null"
                :details="row.patient?.patientNumber ?? null"
              />
            </td>
            <td>
              <div v-if="row.preferredDate" class="queue-cell-inline">
                <span class="queue-cell-main">{{ formatDate(row.preferredDate) }}</span>
                <template v-if="row.preferredTime">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.preferredTime }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td>
              <div v-if="row.confirmedDate" class="queue-cell-inline">
                <span class="queue-cell-main">{{ formatDate(row.confirmedDate) }}</span>
                <template v-if="row.confirmedTime">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.confirmedTime }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td>
              <span class="queue-cell-main">{{ row.provider ?? '—' }}</span>
            </td>
            <td class="queue-action-col">
              <ActionButton
                v-if="row.status === 'confirmed'"
                variant="queue"
                @click.stop="openQueue(row)"
              >
                <template #icon>
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </template>
                Queue patient
              </ActionButton>
            </td>
          </tr>
        </QueueTable>
      </div>

      <div v-show="tab === 'today'" class="space-y-3">
        <QueueEmptyState
          v-if="filteredAppointments.length === 0"
          :title="search.trim() ? 'No matching appointments' : emptyCopy.title"
          :description="search.trim() ? 'Try a different search term or switch tabs.' : emptyCopy.description"
        />
        <QueueTable v-else>
          <template #head>
            <tr>
              <th>Appointment</th>
              <th>Patient</th>
              <th>Preferred</th>
              <th>Confirmed</th>
              <th>Provider</th>
              <th class="text-right">Action</th>
            </tr>
          </template>
          <tr
            v-for="row in filteredAppointments"
            :key="row.id"
            class="cursor-pointer"
            @click="openAppointment(row.id, $event)"
          >
            <td>
              <QueueAppointmentCell
                :appointment-type="row.appointmentType"
                :appointment-purpose="row.appointmentPurpose"
                :created-at-relative="row.createdAtRelative"
                :reason="row.reason"
              />
            </td>
            <td>
              <QueuePatientCell
                :patient-name="row.patient?.fullName ?? null"
                :details="row.patient?.patientNumber ?? null"
              />
            </td>
            <td>
              <div v-if="row.preferredDate" class="queue-cell-inline">
                <span class="queue-cell-main">{{ formatDate(row.preferredDate) }}</span>
                <template v-if="row.preferredTime">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.preferredTime }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td>
              <div v-if="row.confirmedDate" class="queue-cell-inline">
                <span class="queue-cell-main">{{ formatDate(row.confirmedDate) }}</span>
                <template v-if="row.confirmedTime">
                  <span class="queue-cell-sep" aria-hidden="true">·</span>
                  <span class="queue-cell-sub">{{ row.confirmedTime }}</span>
                </template>
              </div>
              <span v-else class="queue-cell-sub">—</span>
            </td>
            <td>
              <span class="queue-cell-main">{{ row.provider ?? '—' }}</span>
            </td>
            <td class="queue-action-col">
              <ActionButton
                v-if="row.status === 'confirmed'"
                variant="queue"
                @click.stop="openQueue(row)"
              >
                <template #icon>
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </template>
                Queue patient
              </ActionButton>
            </td>
          </tr>
        </QueueTable>
      </div>
    </QueuePageShell>

    <!-- Confirm modal -->
    <div
      v-if="confirmTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50" @click="confirmTarget = null" />
      <div class="card relative w-full max-w-md p-5" @keydown.escape="confirmTarget = null">
        <div class="mb-4">
          <h2 class="text-base font-bold text-neutral-900 dark:text-neutral-100">Confirm appointment</h2>
          <p class="mt-0.5 text-xs text-neutral-500">{{ appointmentSubtitle(confirmTarget) }}</p>
        </div>
        <form class="space-y-4" @submit.prevent="submitConfirm">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-neutral-500">Confirmed date</label>
              <input v-model="confirmForm.confirmed_date" type="date" class="theme-field w-full rounded px-3 py-2 text-sm" required />
              <p v-if="confirmForm.errors.confirmed_date" class="mt-1 text-sm text-red-600">{{ confirmForm.errors.confirmed_date }}</p>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-neutral-500">Time</label>
              <input v-model="confirmForm.confirmed_time" type="time" class="theme-field w-full rounded px-3 py-2 text-sm" />
              <p v-if="confirmForm.errors.confirmed_time" class="mt-1 text-sm text-red-600">{{ confirmForm.errors.confirmed_time }}</p>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-neutral-500">Staff notes (optional)</label>
            <input v-model="confirmForm.staff_notes" type="text" maxlength="2000" class="theme-field w-full rounded px-3 py-2 text-sm" />
          </div>
          <div class="flex gap-2 pt-1">
            <ActionButton type="submit" variant="green" :loading="confirmForm.processing" loading-text="Confirming…">
              Confirm
            </ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="confirmTarget = null">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Decline modal -->
    <div
      v-if="declineTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50" @click="declineTarget = null" />
      <div class="card relative w-full max-w-md p-5" @keydown.escape="declineTarget = null">
        <div class="mb-4">
          <h2 class="text-base font-bold text-neutral-900 dark:text-neutral-100">Decline request</h2>
          <p class="mt-0.5 text-xs text-neutral-500">{{ appointmentSubtitle(declineTarget) }}</p>
        </div>
        <form class="space-y-4" @submit.prevent="submitDecline">
          <div>
            <label class="mb-1 block text-xs font-semibold text-neutral-500">Staff notes (optional)</label>
            <textarea v-model="declineForm.staff_notes" rows="3" maxlength="2000" class="theme-field w-full rounded px-3 py-2 text-sm" />
          </div>
          <div class="flex gap-2 pt-1">
            <ActionButton type="submit" variant="danger" :loading="declineForm.processing" loading-text="Declining…">
              Decline
            </ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="declineTarget = null">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Queue modal -->
    <div
      v-if="queueTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50" @click="queueTarget = null" />
      <div class="card relative w-full max-w-md p-5" @keydown.escape="queueTarget = null">
        <div class="mb-4">
          <h2 class="text-base font-bold text-neutral-900 dark:text-neutral-100">Queue patient</h2>
          <p class="mt-0.5 text-xs text-neutral-500">{{ appointmentSubtitle(queueTarget) }}</p>
        </div>
        <form class="space-y-4" @submit.prevent="submitQueue">
          <div>
            <label class="mb-1 block text-xs font-semibold text-neutral-500">Queue to stage</label>
            <select v-model="queueForm.stage" class="theme-field w-full rounded px-3 py-2 text-sm">
              <option v-for="s in stages" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
            <p v-if="queueForm.errors.stage" class="mt-1 text-sm text-red-600">{{ queueForm.errors.stage }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-neutral-500">Notes (optional)</label>
            <input v-model="queueForm.notes" type="text" maxlength="2000" class="theme-field w-full rounded px-3 py-2 text-sm" />
          </div>
          <div class="flex gap-2 pt-1">
            <ActionButton type="submit" variant="blue" :loading="queueForm.processing" loading-text="Submitting…">
              Start &amp; queue
            </ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="queueTarget = null">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
