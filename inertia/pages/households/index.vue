<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'

interface HouseholdRow {
  householdId: string
  headOfHouseName: string
  phoneNumber: string
  village: string
  town: string
  barcode: string
  paymentStatus: string
  headExtractionStatus?: string
  headExtractionLabel?: string
}

interface HouseholdKpis {
  total: number
  activePayment: number
  missingHead: number
  withMembers: number
}

interface KpiCard {
  key: string
  label: string
  value: number
  meta: string
  percent: number
  tone: 'slate' | 'teal' | 'violet' | 'amber'
  icon: 'households' | 'active' | 'members' | 'missing'
}

const props = defineProps<{
  households: HouseholdRow[]
  kpis: HouseholdKpis
  filters: {
    search: string
    paymentStatus: string
    headExtraction: string
  }
  pagination: {
    page: number
    perPage: number
    total: number
    lastPage: number
    from: number
    to: number
  }
}>()

const columns = [
  { key: 'household', label: 'Household' },
  { key: 'location', label: 'Location' },
  { key: 'phoneNumber', label: 'Phone', class: 'w-36 whitespace-nowrap' },
  { key: 'paymentStatus', label: 'Payment', class: 'w-28 whitespace-nowrap' },
  { key: 'headExtractionLabel', label: 'Head Extraction', class: 'w-36 whitespace-nowrap' },
]

const fieldClass =
  'theme-field users-page__filter-field w-full rounded px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const localFilters = reactive({
  search: props.filters.search,
  paymentStatus: props.filters.paymentStatus,
  headExtraction: props.filters.headExtraction,
})

const paymentOptions = [
  { value: '', label: 'All payment states' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
] as const

const extractionOptions = [
  { value: '', label: 'All extraction states' },
  { value: 'extracted', label: 'Already extracted' },
  { value: 'pending', label: 'Not extracted' },
  { value: 'missing', label: 'Missing head' },
] as const

const hasFilters = computed(() =>
  Boolean(localFilters.search.trim() || localFilters.paymentStatus || localFilters.headExtraction)
)

const activeFilterChips = computed(() => {
  const chips: { key: 'search' | 'paymentStatus' | 'headExtraction'; label: string }[] = []

  if (localFilters.search.trim()) {
    chips.push({ key: 'search', label: `Search: “${localFilters.search.trim()}”` })
  }
  if (localFilters.paymentStatus) {
    chips.push({
      key: 'paymentStatus',
      label:
        paymentOptions.find((option) => option.value === localFilters.paymentStatus)?.label ??
        localFilters.paymentStatus,
    })
  }
  if (localFilters.headExtraction) {
    chips.push({
      key: 'headExtraction',
      label:
        extractionOptions.find((option) => option.value === localFilters.headExtraction)?.label ??
        localFilters.headExtraction,
    })
  }

  return chips
})

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

const kpiCards = computed((): KpiCard[] => {
  const total = props.kpis.total
  const withoutMembers = Math.max(0, total - props.kpis.withMembers)
  const inactivePayment = Math.max(0, total - props.kpis.activePayment)

  return [
    {
      key: 'total',
      label: 'Total households',
      value: total,
      meta: 'Registered household records',
      percent: 100,
      tone: 'slate',
      icon: 'households',
    },
    {
      key: 'active',
      label: 'Active payment',
      value: props.kpis.activePayment,
      meta:
        inactivePayment > 0
          ? `${pct(props.kpis.activePayment, total)}% active · ${inactivePayment} other`
          : `${pct(props.kpis.activePayment, total)}% with active payment`,
      percent: pct(props.kpis.activePayment, total),
      tone: 'teal',
      icon: 'active',
    },
    {
      key: 'members',
      label: 'With members',
      value: props.kpis.withMembers,
      meta:
        withoutMembers > 0
          ? `${pct(props.kpis.withMembers, total)}% linked · ${withoutMembers} without patients`
          : 'All households have linked patients',
      percent: pct(props.kpis.withMembers, total),
      tone: 'violet',
      icon: 'members',
    },
    {
      key: 'missing',
      label: 'Missing head',
      value: props.kpis.missingHead,
      meta:
        props.kpis.missingHead > 0
          ? `${pct(props.kpis.missingHead, total)}% need a head of house`
          : 'All households have a head recorded',
      percent: pct(props.kpis.missingHead, total),
      tone: 'amber',
      icon: 'missing',
    },
  ]
})

let searchTimer: ReturnType<typeof setTimeout> | undefined

function visitHouseholds(overrides: Partial<{ page: number; perPage: number }> = {}) {
  router.get(
    '/households',
    {
      search: localFilters.search.trim(),
      payment_status: localFilters.paymentStatus,
      head_extraction: localFilters.headExtraction,
      page: overrides.page ?? 1,
      per_page: overrides.perPage ?? props.pagination.perPage,
    },
    {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      only: ['households', 'kpis', 'filters', 'pagination'],
    }
  )
}

watch(
  () => [localFilters.paymentStatus, localFilters.headExtraction] as const,
  () => visitHouseholds({ page: 1 })
)

watch(
  () => localFilters.search,
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => visitHouseholds({ page: 1 }), 300)
  }
)

watch(
  () => props.filters,
  (next) => {
    localFilters.search = next.search
    localFilters.paymentStatus = next.paymentStatus
    localFilters.headExtraction = next.headExtraction
  },
  { deep: true }
)

function clearFilters() {
  localFilters.search = ''
  localFilters.paymentStatus = ''
  localFilters.headExtraction = ''
  visitHouseholds({ page: 1 })
}

function removeFilter(key: 'search' | 'paymentStatus' | 'headExtraction') {
  localFilters[key] = ''
  visitHouseholds({ page: 1 })
}

function goPage(nextPage: number) {
  if (nextPage < 1 || nextPage > props.pagination.lastPage) return
  visitHouseholds({ page: nextPage })
}

function householdRowHref(row: HouseholdRow) {
  return `/households/${row.householdId}`
}

function householdInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'H'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function locationLabel(row: HouseholdRow): string {
  const parts = [row.village, row.town].map((value) => value?.trim()).filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function extractionClass(status?: string): string {
  if (status === 'extracted') return 'bg-teal-50 text-teal-700'
  if (status === 'pending') return 'bg-amber-50 text-amber-700'
  if (status === 'missing') return 'bg-red-50 text-red-700'
  return 'bg-sand-3 text-sand-11'
}

function paymentClass(status: string): string {
  return status.toLowerCase() === 'active' ? 'bg-teal-50 text-teal-700' : 'bg-sand-3 text-sand-11'
}

function extractAll() {
  if (
    confirm(
      'Extract head-of-house patients for all households? This runs synchronously and may take a while.'
    )
  ) {
    router.post('/households/extract-head-patients', {}, { preserveScroll: true })
  }
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">Household Registry</h1>
          <p class="mt-0.5 text-sm text-sand-11">
            Manage household records, members, barcodes, and head-of-house extraction.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm" @click="extractAll">
            Extract Heads
          </button>
          <Link href="/households/barcodes/print" class="theme-icon-btn rounded px-3 py-1.5 text-sm">
            Print Barcodes
          </Link>
          <Link href="/households/create" class="action-btn action-btn--blue inline-flex items-center justify-center gap-2">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Household
          </Link>
        </div>
      </div>
    </template>

    <div class="users-page__kpi-grid mb-5">
      <div
        v-for="card in kpiCards"
        :key="card.key"
        class="users-page__kpi-card"
        :class="`users-page__kpi-card--${card.tone}`"
      >
        <div class="users-page__kpi-head">
          <div class="users-page__kpi-icon" aria-hidden="true">
            <svg v-if="card.icon === 'households'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <svg v-else-if="card.icon === 'active'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.icon === 'members'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="users-page__kpi-label">{{ card.label }}</p>
        </div>
        <p class="users-page__kpi-value">{{ card.value }}</p>
        <p class="users-page__kpi-meta">{{ card.meta }}</p>
        <div v-if="card.key !== 'total'" class="users-page__kpi-bar" role="presentation">
          <span class="users-page__kpi-bar-fill" :style="{ width: `${card.percent}%` }" />
        </div>
      </div>
    </div>

    <div class="users-page__filters card mb-3 p-3">
      <div class="users-page__filters-row">
        <div class="users-page__filters-field users-page__filters-field--search relative">
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
            v-model="localFilters.search"
            type="search"
            placeholder="Search ID, head, phone, village, town, barcode…"
            :class="[fieldClass, 'pl-8']"
            aria-label="Search households"
          />
        </div>

        <div class="users-page__filters-field">
          <select v-model="localFilters.paymentStatus" :class="fieldClass" aria-label="Filter by payment status">
            <option v-for="option in paymentOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="users-page__filters-field">
          <select v-model="localFilters.headExtraction" :class="fieldClass" aria-label="Filter by head extraction">
            <option v-for="option in extractionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="users-page__filter-count">
            Showing {{ pagination.from }}–{{ pagination.to }} of {{ pagination.total }} households
          </span>
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            class="users-page__filter-chip"
            @click="removeFilter(chip.key)"
          >
            {{ chip.label }}
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <button
          v-if="hasFilters"
          type="button"
          class="users-page__filter-clear"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="households"
      :searchable="false"
      :per-page="Math.max(households.length, 1)"
      :row-href="householdRowHref"
      dark-header
      empty-text="No households match the current filters."
    >
      <template #cell:household="{ row }">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">
            {{ householdInitials(row.headOfHouseName) }}
          </div>
          <div class="min-w-0">
            <Link
              :href="`/households/${row.householdId}`"
              class="font-medium text-slate-900 hover:text-blue-700 hover:underline"
            >
              {{ row.headOfHouseName }}
            </Link>
            <p class="truncate font-mono text-xs text-sand-11">{{ row.householdId }}</p>
          </div>
        </div>
      </template>

      <template #cell:location="{ row }">
        <span class="text-xs text-slate-700">{{ locationLabel(row) }}</span>
      </template>

      <template #cell:phoneNumber="{ row }">
        <span class="text-xs text-slate-700">{{ row.phoneNumber || '—' }}</span>
      </template>

      <template #cell:paymentStatus="{ row }">
        <span class="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="paymentClass(row.paymentStatus)">
          {{ row.paymentStatus }}
        </span>
      </template>

      <template #cell:headExtractionLabel="{ row }">
        <span class="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="extractionClass(row.headExtractionStatus)">
          {{ row.headExtractionLabel }}
        </span>
      </template>

      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/households/${row.householdId}`" title="View household" variant="view" />
        </div>
      </template>
    </DataTable>

    <div
      v-if="pagination.lastPage > 1"
      class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-sand-11"
    >
      <span>Page {{ pagination.page }} of {{ pagination.lastPage }}</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="theme-icon-btn rounded px-3 py-1.5 text-neutral-700 disabled:opacity-50 dark:text-neutral-300"
          :disabled="pagination.page <= 1"
          @click="goPage(pagination.page - 1)"
        >
          Previous
        </button>
        <button
          type="button"
          class="theme-icon-btn rounded px-3 py-1.5 text-neutral-700 disabled:opacity-50 dark:text-neutral-300"
          :disabled="pagination.page >= pagination.lastPage"
          @click="goPage(pagination.page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </StaffLayout>
</template>
