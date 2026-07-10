<script setup lang="ts">
import { ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Subscription {
  id: number
  status: string
  balance: number
  totalDeposited: number
  patientName: string
  patientNumber: string | null
  planName: string
  planTier: number | null
  outstandingAmount: number
  hasOutstanding: boolean
  enrolledAt: string | null
}

interface Plan {
  id: number
  name: string
  tier: number
  minimumDeposit: number
}

const props = defineProps<{
  subscriptions: Subscription[]
  plans: Plan[]
  counts: Record<string, number>
  status: string | null
}>()

const columns = [
  { key: 'patientName', label: 'Patient' },
  { key: 'planName', label: 'Plan' },
  { key: 'balance', label: 'Balance' },
  { key: 'status', label: 'Status' },
]

function filterStatus(value: string | null) {
  router.get('/subscriptions', value ? { status: value } : {}, { preserveState: false })
}

// ── Enroll form with patient autocomplete ─────────────────────────────────
const showForm = ref(false)
const searchTerm = ref('')
const searchResults = ref<{ id: number; label: string }[]>([])
const selectedLabel = ref('')

const form = useForm({
  patient_id: null as number | null,
  membership_plan_id: null as number | null,
  amount: 0,
  mark_paid: false,
  payment_method: 'cash',
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
async function searchPatients() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const res = await fetch(`/subscriptions/patients/search?q=${encodeURIComponent(searchTerm.value)}`, {
      headers: { Accept: 'application/json' },
    })
    searchResults.value = res.ok ? await res.json() : []
  }, 250)
}

function pickPatient(p: { id: number; label: string }) {
  form.patient_id = p.id
  selectedLabel.value = p.label
  searchResults.value = []
  searchTerm.value = ''
}

function submit() {
  form.post('/subscriptions', {
    onSuccess: () => {
      showForm.value = false
      form.reset()
      selectedLabel.value = ''
    },
  })
}

const payMethods = ref<Record<number, string>>({})
function pay(sub: Subscription) {
  router.post(`/subscriptions/${sub.id}/pay`, { payment_method: payMethods.value[sub.id] || 'cash' })
}

function cancel(sub: Subscription) {
  if (confirm('Cancel this wellness fund account?')) {
    router.post(`/subscriptions/${sub.id}/cancel`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Wellness Fund Subscriptions</h1></template>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          class="rounded border border-sand-6 px-3 py-1.5"
          :class="!props.status ? 'bg-blue-600 text-white' : ''"
          @click="filterStatus(null)"
        >
          All
        </button>
        <button
          v-for="(total, key) in props.counts"
          :key="key"
          type="button"
          class="rounded border border-sand-6 px-3 py-1.5 capitalize"
          :class="props.status === key ? 'bg-blue-600 text-white' : ''"
          @click="filterStatus(String(key))"
        >
          {{ key }} ({{ total }})
        </button>
      </div>
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="showForm = true">
        Enroll Patient
      </button>
    </div>

    <DataTable :columns="columns" :rows="props.subscriptions">
      <template #cell:balance="{ row }">ZMW {{ row.balance.toFixed(2) }}</template>
      <template #cell:status="{ row }">
        <span class="capitalize">{{ row.status }}</span>
      </template>
      <template #actions="{ row }">
        <span v-if="row.hasOutstanding" class="inline-flex items-center gap-1">
          <select v-model="payMethods[row.id]" class="rounded border border-sand-6 px-1 py-0.5 text-xs">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
          <button type="button" class="text-green-700 hover:underline" @click="pay(row)">
            Pay (ZMW {{ row.outstandingAmount.toFixed(2) }})
          </button>
        </span>
        <button
          v-if="row.status !== 'cancelled'"
          type="button"
          class="ml-3 text-red-600 hover:underline"
          @click="cancel(row)"
        >
          Cancel
        </button>
      </template>
    </DataTable>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Enroll Patient</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div>
            <label class="mb-1 block text-sm font-medium">Patient</label>
            <div v-if="selectedLabel" class="mb-1 flex items-center justify-between rounded bg-sand-3 px-3 py-2 text-sm">
              <span>{{ selectedLabel }}</span>
              <button type="button" class="text-red-600" @click="form.patient_id = null; selectedLabel = ''">✕</button>
            </div>
            <input
              v-else
              v-model="searchTerm"
              type="search"
              placeholder="Search name or patient ID…"
              class="theme-field w-full rounded px-3 py-2"
              @input="searchPatients"
            />
            <ul v-if="searchResults.length" class="mt-1 max-h-40 overflow-y-auto rounded border border-sand-6">
              <li
                v-for="p in searchResults"
                :key="p.id"
                class="cursor-pointer px-3 py-1.5 text-sm hover:bg-sand-3"
                @click="pickPatient(p)"
              >
                {{ p.label }}
              </li>
            </ul>
            <p v-if="form.errors.patient_id" class="mt-1 text-sm text-red-600">{{ form.errors.patient_id }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Plan</label>
            <select v-model.number="form.membership_plan_id" class="theme-field w-full rounded px-3 py-2">
              <option :value="null" disabled>Select a plan…</option>
              <option v-for="plan in props.plans" :key="plan.id" :value="plan.id">
                {{ plan.name }} (min ZMW {{ plan.minimumDeposit.toFixed(2) }})
              </option>
            </select>
            <p v-if="form.errors.membership_plan_id" class="mt-1 text-sm text-red-600">{{ form.errors.membership_plan_id }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Amount</label>
            <input v-model.number="form.amount" type="number" step="0.01" min="1" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.amount" class="mt-1 text-sm text-red-600">{{ form.errors.amount }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.mark_paid" type="checkbox" /> Mark deposit as paid now
          </label>
          <div v-if="form.mark_paid">
            <label class="mb-1 block text-sm font-medium">Payment Method</label>
            <select v-model="form.payment_method" class="theme-field w-full rounded px-3 py-2">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Enrolling…">Enroll</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
