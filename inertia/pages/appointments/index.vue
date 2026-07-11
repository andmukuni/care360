<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import QueueTable from '~/components/staff/queue/QueueTable.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueSearchField from '~/components/staff/queue/QueueSearchField.vue'
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
  patient: Patient | null
}

const props = defineProps<{
  tab: string
  pendingCount: number
  confirmedCount: number
  todayCount: number
  appointments: Appointment[]
}>()

const search = ref('')

const tabs = [
  { key: 'pending', label: 'Pending', count: () => props.pendingCount },
  { key: 'confirmed', label: 'Confirmed', count: () => props.confirmedCount },
  { key: 'today', label: 'Today', count: () => props.todayCount },
] as const

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

function formatWhen(date: string | null, time: string | null): string {
  const dateLabel = formatDate(date)
  if (dateLabel === '—') return '—'
  return time ? `${dateLabel} · ${time}` : dateLabel
}

function appointmentSubtitle(a: Appointment): string {
  const patient = a.patient?.fullName ?? '—'
  const when =
    props.tab === 'pending'
      ? formatWhen(a.preferredDate, a.preferredTime)
      : formatWhen(a.confirmedDate ?? a.preferredDate, a.confirmedTime ?? a.preferredTime)
  return `${patient} · ${when}`
}

function switchTab(tab: string) {
  router.get('/appointments', { tab }, { preserveState: false })
}

function openAppointment(id: number, event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('a, button, input, select, textarea, label')) return
  router.visit(`/appointments/${id}`)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
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

    <div class="queue-page w-full space-y-5">
      <header class="queue-page-header">
        <div class="min-w-0 flex-1">
          <h1 class="queue-page-title">Appointments</h1>
          <p class="queue-page-description">
            Review portal requests and manage confirmed bookings.
          </p>
        </div>
      </header>

      <div class="queue-stat-row">
        <div class="queue-stat">
          <span class="queue-stat-label">Pending</span>
          <span class="queue-stat-value">{{ formatNumber(pendingCount) }}</span>
        </div>
        <div class="queue-stat">
          <span class="queue-stat-label">Confirmed</span>
          <span class="queue-stat-value">{{ formatNumber(confirmedCount) }}</span>
        </div>
        <div class="queue-stat">
          <span class="queue-stat-label">Today</span>
          <span class="queue-stat-value">{{ formatNumber(todayCount) }}</span>
        </div>
      </div>

      <div class="queue-segments queue-segments--full" role="tablist" aria-label="Appointment views">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          class="queue-segment"
          :class="{ active: tab === t.key }"
          :aria-selected="tab === t.key"
          @click="switchTab(t.key)"
        >
          <span>{{ t.label }}</span>
          <span
            v-if="t.count() > 0"
            class="queue-segment-count"
            :class="t.key === 'pending' && pendingCount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : ''"
          >
            {{ t.count() }}
          </span>
        </button>
      </div>

      <QueueSearchField
        v-model="search"
        label="Search appointments"
        placeholder="Search by patient, type, reason, or provider…"
        :hint="`${filteredAppointments.length} of ${appointments.length} shown`"
      />

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
            <th v-if="tab === 'pending'">Alternate</th>
            <template v-else>
              <th>Confirmed</th>
              <th>Provider</th>
            </template>
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
            <div class="flex flex-wrap items-center gap-2">
              <span class="queue-cell-main">{{ row.appointmentType }}</span>
              <span v-if="row.appointmentPurpose" class="queue-chip queue-chip--info">
                {{ row.appointmentPurpose }}
              </span>
            </div>
            <p v-if="row.reason" class="mt-0.5 max-w-[280px] truncate text-xs text-neutral-400">
              {{ row.reason }}
            </p>
          </td>

          <td>
            <template v-if="row.patient">
              <Link
                :href="`/patients/${row.patient.patientNumber}`"
                class="queue-cell-main hover:underline"
                @click.stop
              >
                {{ row.patient.fullName }}
              </Link>
              <span class="mt-0.5 block font-mono text-xs text-neutral-400">{{ row.patient.patientNumber }}</span>
            </template>
            <span v-else class="text-neutral-400">—</span>
          </td>

          <td class="whitespace-nowrap text-neutral-700 dark:text-neutral-200">
            {{ formatWhen(row.preferredDate, row.preferredTime) }}
          </td>

          <td v-if="tab === 'pending'" class="whitespace-nowrap text-neutral-500">
            {{ row.alternateDate ? formatWhen(row.alternateDate, row.alternateTime) : '—' }}
          </td>

          <template v-else>
            <td class="whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-400">
              {{ formatWhen(row.confirmedDate, row.confirmedTime) }}
            </td>
            <td class="whitespace-nowrap text-neutral-700 dark:text-neutral-200">
              {{ row.provider ?? '—' }}
            </td>
          </template>

          <td class="queue-action-col">
            <div v-if="tab === 'pending'" class="inline-flex flex-wrap justify-end gap-2">
              <button type="button" class="queue-btn queue-btn--primary" @click.stop="openConfirm(row)">
                Confirm
              </button>
              <button
                type="button"
                class="queue-btn border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                @click.stop="openDecline(row)"
              >
                Decline
              </button>
            </div>
            <button
              v-else-if="row.status === 'confirmed'"
              type="button"
              class="queue-btn queue-btn--primary"
              @click.stop="openQueue(row)"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              Queue patient
            </button>
          </td>
        </tr>
      </QueueTable>
    </div>

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
