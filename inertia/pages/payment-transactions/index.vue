<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface Transaction {
  id: number
  provider: string
  reference: string
  gatewayReference: string | null
  operator: string | null
  phone: string | null
  amount: number
  currency: string
  status: string
  failureReason: string | null
  lastCheckedAt: string | null
  createdAt: string | null
  createdAtFormatted: string | null
  patientName: string
  patientNumber: string | null
  invoiceNumber: string | null
}

const props = defineProps<{
  filters: Record<string, string | null | undefined>
  transactions: Transaction[]
}>()

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'otp-required', label: 'OTP Required' },
  { value: 'pay-offline', label: 'Pay Offline' },
  { value: 'successful', label: 'Successful' },
  { value: 'failed', label: 'Failed' },
]

const openStatuses = ['pending', 'otp-required', 'pay-offline']

const form = reactive({
  search: '',
  status: '',
  date_from: '',
  date_to: '',
})

watch(
  () => props.filters,
  (filters) => {
    form.search = filters.search ?? ''
    form.status = filters.status ?? ''
    form.date_from = filters.date_from ?? ''
    form.date_to = filters.date_to ?? ''
  },
  { immediate: true, deep: true }
)

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const hasFilters = computed(() =>
  Object.values(form).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof form; label: string }[] = []

  if (form.search.trim()) chips.push({ key: 'search', label: `Search: “${form.search.trim()}”` })
  if (form.status) {
    chips.push({
      key: 'status',
      label: `Status: ${statusOptions.find((o) => o.value === form.status)?.label ?? form.status}`,
    })
  }
  if (form.date_from) chips.push({ key: 'date_from', label: `From ${form.date_from}` })
  if (form.date_to) chips.push({ key: 'date_to', label: `To ${form.date_to}` })

  return chips
})

function applyFilters() {
  const data = Object.fromEntries(
    Object.entries(form).filter(([, value]) => String(value ?? '').trim() !== '')
  )
  router.get('/payment-transactions', data, { preserveState: true, preserveScroll: true })
}

function clearFilters() {
  Object.assign(form, {
    search: '',
    status: '',
    date_from: '',
    date_to: '',
  })
  router.get('/payment-transactions', {}, { preserveState: true, preserveScroll: true })
}

function removeFilter(key: keyof typeof form) {
  form[key] = ''
  applyFilters()
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'successful':
      return 'badge b-green'
    case 'failed':
      return 'badge b-red'
    case 'pending':
    case 'otp-required':
      return 'badge b-amber'
    case 'pay-offline':
      return 'badge b-blue'
    default:
      return 'badge b-gray'
  }
}

function statusLabel(status: string): string {
  return statusOptions.find((o) => o.value === status)?.label ?? status
}

function checkStatus(t: Transaction) {
  router.post(`/payment-transactions/${t.id}/check`, {}, { preserveScroll: true })
}

function retry(t: Transaction) {
  router.post(`/payment-transactions/${t.id}/retry`, {}, { preserveScroll: true })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Payment Transactions</h1></template>

    <p class="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
      Mobile-money collections. Re-check a pending one with the gateway, or retry a failed one.
    </p>

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
            v-model="form.search"
            type="search"
            placeholder="Search reference, patient, invoice, phone…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="form.status" :class="fieldClass" aria-label="Status">
            <option value="">All statuses</option>
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-2">
          <input v-model="form.date_from" type="date" :class="fieldClass" aria-label="From date" />
        </div>

        <div class="col-span-1 lg:col-span-2">
          <input v-model="form.date_to" type="date" :class="fieldClass" aria-label="To date" />
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
          {{ transactions.length }} result{{ transactions.length === 1 ? '' : 's' }}
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
              <th class="px-4 py-2.5 text-left">Reference</th>
              <th class="px-4 py-2.5 text-left">Patient</th>
              <th class="px-4 py-2.5 text-left">Operator / Phone</th>
              <th class="px-4 py-2.5 text-right">Amount</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="px-4 py-2.5 text-left">When</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="row in transactions"
              :key="row.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">{{ row.reference }}</span>
                <div v-if="row.invoiceNumber" class="text-xs text-neutral-400">{{ row.invoiceNumber }}</div>
              </td>
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
                <span class="uppercase">{{ row.operator ?? '—' }}</span>
                <div v-if="row.phone" class="text-xs text-neutral-400">{{ row.phone }}</div>
              </td>
              <td class="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                {{ row.currency }} {{ row.amount.toFixed(2) }}
              </td>
              <td class="px-4 py-2.5">
                <span :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
                <div v-if="row.failureReason" class="mt-1 text-[11px] text-red-500">{{ row.failureReason }}</div>
              </td>
              <td class="px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                {{ row.createdAtFormatted ?? '—' }}
              </td>
              <td class="encounters-table__actions px-4 py-2.5">
                <div class="table-action-group">
                  <TableIconButton
                    v-if="openStatuses.includes(row.status)"
                    variant="refresh"
                    title="Check payment status"
                    @click="checkStatus(row)"
                  />
                  <TableIconButton
                    v-if="row.status === 'failed'"
                    variant="retry"
                    tone="primary"
                    title="Retry payment"
                    @click="retry(row)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!transactions.length">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No transactions match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>No transactions yet.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </StaffLayout>
</template>
