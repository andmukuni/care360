<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

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
  enrolledAtFormatted: string | null
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
  filters: Record<string, string | null | undefined>
}>()

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
  { value: 'past_due', label: 'Past due' },
]

const filterForm = reactive({
  search: '',
  status: '',
  date_from: '',
  date_to: '',
})

watch(
  () => props.filters,
  (filters) => {
    filterForm.search = filters.search ?? ''
    filterForm.status = filters.status ?? ''
    filterForm.date_from = filters.date_from ?? ''
    filterForm.date_to = filters.date_to ?? ''
  },
  { immediate: true, deep: true }
)

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const hasFilters = computed(() =>
  Object.values(filterForm).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  if (filterForm.status) {
    chips.push({
      key: 'status',
      label: `Status: ${statusOptions.find((o) => o.value === filterForm.status)?.label ?? filterForm.status}`,
    })
  }
  if (filterForm.date_from) chips.push({ key: 'date_from', label: `From ${filterForm.date_from}` })
  if (filterForm.date_to) chips.push({ key: 'date_to', label: `To ${filterForm.date_to}` })

  return chips
})

function applyFilters() {
  const data = Object.fromEntries(
    Object.entries(filterForm).filter(([, value]) => String(value ?? '').trim() !== '')
  )
  router.get('/subscriptions', data, { preserveState: true, preserveScroll: true })
}

function clearFilters() {
  Object.assign(filterForm, {
    search: '',
    status: '',
    date_from: '',
    date_to: '',
  })
  router.get('/subscriptions', {}, { preserveState: true, preserveScroll: true })
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = ''
  applyFilters()
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge b-green'
    case 'pending':
      return 'badge b-amber'
    case 'cancelled':
      return 'badge b-gray'
    case 'expired':
    case 'past_due':
      return 'badge b-red'
    default:
      return 'badge b-gray'
  }
}

function statusLabel(status: string): string {
  return statusOptions.find((o) => o.value === status)?.label ?? status.replace(/_/g, ' ')
}

// ── Enroll form with patient autocomplete ─────────────────────────────────
const showForm = ref(false)
const searchTerm = ref('')
const searchResults = ref<{ id: number; label: string }[]>([])
const selectedLabel = ref('')

const enrollForm = useForm({
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
  enrollForm.patient_id = p.id
  selectedLabel.value = p.label
  searchResults.value = []
  searchTerm.value = ''
}

function submitEnroll() {
  enrollForm.post('/subscriptions', {
    onSuccess: () => {
      showForm.value = false
      enrollForm.reset()
      selectedLabel.value = ''
    },
  })
}

const payMethods = ref<Record<number, string>>({})
function pay(sub: Subscription) {
  router.post(`/subscriptions/${sub.id}/pay`, { payment_method: payMethods.value[sub.id] || 'cash' }, { preserveScroll: true })
}

async function cancel(sub: Subscription) {
  if (!(await confirmDialog('Cancel this wellness fund account?'))) return
  router.post(`/subscriptions/${sub.id}/cancel`, {}, { preserveScroll: true })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Wellness Fund Subscriptions</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Patient wellness fund accounts. Enroll new members or collect outstanding deposits.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        @click="showForm = true"
      >
        Enroll Patient
      </button>
    </div>

    <form class="card mb-3 p-3" @submit.prevent="applyFilters">
      <div class="grid grid-cols-2 items-end gap-2 lg:grid-cols-12">
        <div class="relative col-span-2 lg:col-span-4">
          <svg
            class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="filterForm.search"
            type="search"
            placeholder="Search patient, ID, or plan…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.status" :class="fieldClass" aria-label="Status">
            <option value="">All statuses</option>
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}{{ counts[option.value] ? ` (${counts[option.value]})` : '' }}
            </option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-2">
          <input v-model="filterForm.date_from" type="date" :class="fieldClass" aria-label="From date" />
        </div>

        <div class="col-span-1 lg:col-span-2">
          <input v-model="filterForm.date_to" type="date" :class="fieldClass" aria-label="To date" />
        </div>

        <div class="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-1">
          <button
            v-if="hasFilters"
            type="button"
            class="theme-icon-btn btn-icon inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Clear filters"
            aria-label="Clear filters"
            @click="clearFilters"
          >
            <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="submit"
            class="btn-icon btn-icon--primary"
            title="Apply filters"
            aria-label="Apply filters"
          >
            <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        v-if="hasFilters"
        class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800"
      >
        <span class="text-[11px] text-neutral-500">
          {{ subscriptions.length }} result{{ subscriptions.length === 1 ? '' : 's' }}
        </span>
        <button
          v-for="chip in activeFilterChips"
          :key="chip.key"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300"
          @click="removeFilter(chip.key)"
        >
          {{ chip.label }}
          <svg class="h-2.5 w-2.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </form>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[960px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Patient</th>
              <th class="px-4 py-2.5 text-left">Plan</th>
              <th class="px-4 py-2.5 text-right">Balance</th>
              <th class="px-4 py-2.5 text-right">Total Deposited</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="px-4 py-2.5 text-left">Enrolled</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="row in subscriptions"
              :key="row.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <Link
                  v-if="row.patientNumber"
                  :href="`/patients/${row.patientNumber}`"
                  class="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                >
                  {{ row.patientName }}
                </Link>
                <span v-else class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.patientName }}</span>
                <div v-if="row.patientNumber" class="text-xs text-neutral-400">{{ row.patientNumber }}</div>
              </td>
              <td class="px-4 py-2.5">
                <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.planName }}</span>
                <div v-if="row.planTier" class="text-xs text-neutral-400">Tier {{ row.planTier }}</div>
              </td>
              <td class="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                ZMW {{ row.balance.toFixed(2) }}
              </td>
              <td class="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                ZMW {{ row.totalDeposited.toFixed(2) }}
              </td>
              <td class="px-4 py-2.5">
                <span :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
              </td>
              <td class="px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                {{ row.enrolledAtFormatted ?? '—' }}
              </td>
              <td class="encounters-table__actions px-4 py-2.5">
                <div class="table-action-group">
                  <select
                    v-if="row.hasOutstanding"
                    v-model="payMethods[row.id]"
                    class="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600"
                    aria-label="Payment method"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                  <TableIconButton
                    v-if="row.hasOutstanding"
                    variant="pay"
                    tone="primary"
                    :title="`Pay ZMW ${row.outstandingAmount.toFixed(2)}`"
                    @click="pay(row)"
                  />
                  <TableIconButton
                    v-if="row.status !== 'cancelled'"
                    variant="cancel"
                    tone="danger"
                    title="Cancel subscription"
                    @click="cancel(row)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!subscriptions.length">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No subscriptions match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>No subscriptions yet.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Enroll Patient</h2>
        <form class="space-y-3" @submit.prevent="submitEnroll">
          <div>
            <label class="mb-1 block text-sm font-medium">Patient</label>
            <div v-if="selectedLabel" class="mb-1 flex items-center justify-between rounded bg-sand-3 px-3 py-2 text-sm">
              <span>{{ selectedLabel }}</span>
              <button type="button" class="text-red-600" @click="enrollForm.patient_id = null; selectedLabel = ''">✕</button>
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
            <p v-if="enrollForm.errors.patient_id" class="mt-1 text-sm text-red-600">{{ enrollForm.errors.patient_id }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Plan</label>
            <select v-model.number="enrollForm.membership_plan_id" class="theme-field w-full rounded px-3 py-2">
              <option :value="null" disabled>Select a plan…</option>
              <option v-for="plan in props.plans" :key="plan.id" :value="plan.id">
                {{ plan.name }} (min ZMW {{ plan.minimumDeposit.toFixed(2) }})
              </option>
            </select>
            <p v-if="enrollForm.errors.membership_plan_id" class="mt-1 text-sm text-red-600">{{ enrollForm.errors.membership_plan_id }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Amount</label>
            <input v-model.number="enrollForm.amount" type="number" step="0.01" min="1" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="enrollForm.errors.amount" class="mt-1 text-sm text-red-600">{{ enrollForm.errors.amount }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="enrollForm.mark_paid" type="checkbox" /> Mark deposit as paid now
          </label>
          <div v-if="enrollForm.mark_paid">
            <label class="mb-1 block text-sm font-medium">Payment Method</label>
            <select v-model="enrollForm.payment_method" class="theme-field w-full rounded px-3 py-2">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="enrollForm.processing" loading-text="Enrolling…">Enroll</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
