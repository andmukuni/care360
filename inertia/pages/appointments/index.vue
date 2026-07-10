<script setup lang="ts">
import { ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
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
  confirmedDate: string | null
  confirmedTime: string | null
  provider: string | null
  patient: Patient | null
}

const props = defineProps<{
  tab: string
  pendingCount: number
  appointments: Appointment[]
}>()

const tabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'today', label: 'Today' },
]

const columns = [
  { key: 'patientName', label: 'Patient' },
  { key: 'appointmentType', label: 'Type' },
  { key: 'preferredDate', label: 'Preferred' },
  { key: 'confirmedDate', label: 'Confirmed' },
  { key: 'provider', label: 'Provider' },
  { key: 'status', label: 'Status' },
]

const rows = props.appointments.map((a) => ({
  ...a,
  patientName: a.patient?.fullName ?? '—',
}))

function switchTab(tab: string) {
  router.get('/appointments', { tab }, { preserveState: false })
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
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Appointments</h1></template>

    <div class="mb-4 flex gap-2 text-sm">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="rounded border border-sand-6 px-3 py-1.5"
        :class="props.tab === t.key ? 'bg-blue-600 text-white' : ''"
        @click="switchTab(t.key)"
      >
        {{ t.label }}
        <span v-if="t.key === 'pending'" class="ml-1 rounded-full bg-red-100 px-1.5 text-xs text-red-700">{{ props.pendingCount }}</span>
      </button>
    </div>

    <DataTable :columns="columns" :rows="rows" :search-keys="['patientName', 'appointmentType', 'reason']">
      <template #cell:patientName="{ row }">
        <Link :href="`/appointments/${row.id}`" class="text-blue-600 hover:underline">{{ row.patientName }}</Link>
        <div class="text-xs text-sand-11">{{ row.patient?.patientNumber }}</div>
      </template>
      <template #cell:preferredDate="{ row }">
        {{ row.preferredDate ?? '—' }} <span class="text-sand-11">{{ row.preferredTime }}</span>
      </template>
      <template #cell:confirmedDate="{ row }">
        {{ row.confirmedDate ?? '—' }} <span class="text-sand-11">{{ row.confirmedTime }}</span>
      </template>
      <template #cell:status="{ row }"><span class="capitalize">{{ row.status }}</span></template>
      <template #actions="{ row }">
        <Link :href="`/appointments/${row.id}`" class="text-blue-600 hover:underline">View</Link>
        <template v-if="row.status === 'pending'">
          <button type="button" class="ml-3 text-green-700 hover:underline" @click="openConfirm(row)">Confirm</button>
          <button type="button" class="ml-3 text-red-600 hover:underline" @click="openDecline(row)">Decline</button>
        </template>
        <button v-if="row.status === 'confirmed'" type="button" class="ml-3 text-blue-600 hover:underline" @click="openQueue(row)">
          Queue
        </button>
      </template>
    </DataTable>

    <!-- Confirm modal -->
    <div v-if="confirmTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Confirm Appointment</h2>
        <form class="space-y-3" @submit.prevent="submitConfirm">
          <div>
            <label class="mb-1 block text-sm font-medium">Confirmed Date</label>
            <input v-model="confirmForm.confirmed_date" type="date" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="confirmForm.errors.confirmed_date" class="mt-1 text-sm text-red-600">{{ confirmForm.errors.confirmed_date }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Confirmed Time</label>
            <input v-model="confirmForm.confirmed_time" type="time" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="confirmForm.errors.confirmed_time" class="mt-1 text-sm text-red-600">{{ confirmForm.errors.confirmed_time }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Staff Notes</label>
            <textarea v-model="confirmForm.staff_notes" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="green" :loading="confirmForm.processing" loading-text="Confirming…">Confirm</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="confirmTarget = null">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Decline modal -->
    <div v-if="declineTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Decline Appointment</h2>
        <form class="space-y-3" @submit.prevent="submitDecline">
          <div>
            <label class="mb-1 block text-sm font-medium">Staff Notes</label>
            <textarea v-model="declineForm.staff_notes" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="danger" :loading="declineForm.processing" loading-text="Declining…">Decline</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="declineTarget = null">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Queue modal -->
    <div v-if="queueTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Start Encounter &amp; Queue</h2>
        <form class="space-y-3" @submit.prevent="submitQueue">
          <div>
            <label class="mb-1 block text-sm font-medium">Queue to Stage</label>
            <select v-model="queueForm.stage" class="theme-field w-full rounded px-3 py-2">
              <option v-for="s in stages" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
            <p v-if="queueForm.errors.stage" class="mt-1 text-sm text-red-600">{{ queueForm.errors.stage }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Notes</label>
            <textarea v-model="queueForm.notes" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="queueForm.processing" loading-text="Submitting…">Start &amp; Queue</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="queueTarget = null">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
