<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'

interface PatientRow {
  patientId: string
  fullName: string
  gender: string
  dateOfBirth: string | null
  phoneNumber: string
  householdId: string
  barcode: string
  status: string
  isDeceased: boolean
}

interface PatientKpis {
  total: number
  active: number
  deceased: number
  withHousehold: number
}

interface KpiCard {
  key: string
  label: string
  value: number
  meta: string
  percent: number
  tone: 'slate' | 'teal' | 'violet' | 'amber'
  icon: 'patients' | 'active' | 'household' | 'deceased'
}

const props = defineProps<{
  patients: PatientRow[]
  kpis: PatientKpis
  filters: {
    search: string
    householdId: string
    gender: string
    status: string
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
  { key: 'patient', label: 'Patient' },
  { key: 'gender', label: 'Gender', class: 'w-24 whitespace-nowrap' },
  { key: 'dateOfBirth', label: 'Date of Birth', class: 'w-32 whitespace-nowrap' },
  { key: 'phoneNumber', label: 'Phone', class: 'w-36 whitespace-nowrap' },
  { key: 'householdId', label: 'Household', class: 'w-32 whitespace-nowrap' },
  { key: 'status', label: 'Status', class: 'w-28 whitespace-nowrap' },
]

const fieldClass =
  'theme-field users-page__filter-field w-full rounded px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const localFilters = reactive({
  search: props.filters.search,
  gender: props.filters.gender,
  status: props.filters.status,
})

const genderOptions = [
  { value: '', label: 'All genders' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
] as const

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'deceased', label: 'Deceased' },
] as const

const hasFilters = computed(() =>
  Boolean(
    localFilters.search.trim() ||
      localFilters.gender ||
      localFilters.status ||
      props.filters.householdId
  )
)

const activeFilterChips = computed(() => {
  const chips: { key: 'search' | 'gender' | 'status' | 'householdId'; label: string }[] = []

  if (localFilters.search.trim()) {
    chips.push({ key: 'search', label: `Search: “${localFilters.search.trim()}”` })
  }
  if (localFilters.gender) {
    chips.push({
      key: 'gender',
      label: genderOptions.find((option) => option.value === localFilters.gender)?.label ?? localFilters.gender,
    })
  }
  if (localFilters.status) {
    chips.push({
      key: 'status',
      label: statusOptions.find((option) => option.value === localFilters.status)?.label ?? localFilters.status,
    })
  }
  if (props.filters.householdId) {
    chips.push({ key: 'householdId', label: `Household: ${props.filters.householdId}` })
  }

  return chips
})

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

const kpiCards = computed((): KpiCard[] => {
  const total = props.kpis.total
  const withoutHousehold = total - props.kpis.withHousehold
  const inactive = Math.max(0, total - props.kpis.active - props.kpis.deceased)

  return [
    {
      key: 'total',
      label: 'Total patients',
      value: total,
      meta: 'Registered in the system',
      percent: 100,
      tone: 'slate',
      icon: 'patients',
    },
    {
      key: 'active',
      label: 'Active patients',
      value: props.kpis.active,
      meta:
        inactive > 0
          ? `${pct(props.kpis.active, total)}% active · ${inactive} inactive`
          : `${pct(props.kpis.active, total)}% currently active`,
      percent: pct(props.kpis.active, total),
      tone: 'teal',
      icon: 'active',
    },
    {
      key: 'household',
      label: 'Linked households',
      value: props.kpis.withHousehold,
      meta:
        withoutHousehold > 0
          ? `${pct(props.kpis.withHousehold, total)}% linked · ${withoutHousehold} unlinked`
          : 'All patients linked to a household',
      percent: pct(props.kpis.withHousehold, total),
      tone: 'violet',
      icon: 'household',
    },
    {
      key: 'deceased',
      label: 'Deceased',
      value: props.kpis.deceased,
      meta:
        props.kpis.deceased > 0
          ? `${pct(props.kpis.deceased, total)}% of registry`
          : 'No deceased records',
      percent: pct(props.kpis.deceased, total),
      tone: 'amber',
      icon: 'deceased',
    },
  ]
})

let searchTimer: ReturnType<typeof setTimeout> | undefined

function visitPatients(overrides: Partial<{ page: number; perPage: number }> = {}) {
  router.get(
    '/patients',
    {
      search: localFilters.search.trim(),
      gender: localFilters.gender,
      status: localFilters.status,
      householdId: props.filters.householdId,
      page: overrides.page ?? 1,
      per_page: overrides.perPage ?? props.pagination.perPage,
    },
    {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      only: ['patients', 'kpis', 'filters', 'pagination'],
    }
  )
}

watch(
  () => [localFilters.gender, localFilters.status] as const,
  () => visitPatients({ page: 1 })
)

watch(
  () => localFilters.search,
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => visitPatients({ page: 1 }), 300)
  }
)

watch(
  () => props.filters,
  (next) => {
    localFilters.search = next.search
    localFilters.gender = next.gender
    localFilters.status = next.status
  },
  { deep: true }
)

function clearFilters() {
  localFilters.search = ''
  localFilters.gender = ''
  localFilters.status = ''
  visitPatients({ page: 1 })
}

function removeFilter(key: 'search' | 'gender' | 'status' | 'householdId') {
  if (key === 'householdId') {
    router.get('/patients', {
      search: localFilters.search.trim(),
      gender: localFilters.gender,
      status: localFilters.status,
      page: 1,
      per_page: props.pagination.perPage,
    }, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      only: ['patients', 'kpis', 'filters', 'pagination'],
    })
    return
  }

  localFilters[key] = ''
  visitPatients({ page: 1 })
}

function goPage(nextPage: number) {
  if (nextPage < 1 || nextPage > props.pagination.lastPage) return
  visitPatients({ page: nextPage })
}

function patientRowHref(row: PatientRow) {
  return `/patients/${row.patientId}`
}

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'P'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function formatDob(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">Patient Registry</h1>
          <p class="mt-0.5 text-sm text-sand-11">
            Search, review, and register patients across the hospital system.
          </p>
        </div>
        <Link href="/patients/create" class="action-btn action-btn--blue inline-flex items-center justify-center gap-2">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Register Patient
        </Link>
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
            <svg v-if="card.icon === 'patients'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else-if="card.icon === 'active'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.icon === 'household'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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
            placeholder="Search ID, name, phone, NRC, barcode, household…"
            :class="[fieldClass, 'pl-8']"
            aria-label="Search patients"
          />
        </div>

        <div class="users-page__filters-field">
          <select v-model="localFilters.gender" :class="fieldClass" aria-label="Filter by gender">
            <option v-for="option in genderOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="users-page__filters-field">
          <select v-model="localFilters.status" :class="fieldClass" aria-label="Filter by status">
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="users-page__filter-count">
            Showing {{ pagination.from }}–{{ pagination.to }} of {{ pagination.total }} patients
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
      :rows="patients"
      :searchable="false"
      :per-page="Math.max(patients.length, 1)"
      :row-href="patientRowHref"
      dark-header
      empty-text="No patients match the current filters."
    >
      <template #cell:patient="{ row }">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            :class="row.isDeceased ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'"
          >
            {{ patientInitials(row.fullName) }}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <Link
                :href="`/patients/${row.patientId}`"
                class="font-medium text-slate-900 hover:text-blue-700 hover:underline"
                :class="row.isDeceased ? 'text-red-700' : ''"
              >
                {{ row.fullName }}
              </Link>
              <span
                v-if="row.isDeceased"
                class="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"
              >
                deceased
              </span>
            </div>
            <p class="truncate font-mono text-xs text-sand-11">{{ row.patientId }}</p>
          </div>
        </div>
      </template>

      <template #cell:gender="{ row }">
        <span class="text-slate-700">{{ row.gender || '—' }}</span>
      </template>

      <template #cell:dateOfBirth="{ row }">
        <span class="text-xs text-sand-11">{{ formatDob(row.dateOfBirth) }}</span>
      </template>

      <template #cell:phoneNumber="{ row }">
        <span class="text-xs text-slate-700">{{ row.phoneNumber || '—' }}</span>
      </template>

      <template #cell:householdId="{ row }">
        <Link
          v-if="row.householdId"
          :href="`/households/${row.householdId}`"
          class="font-mono text-xs text-blue-700 hover:underline"
        >
          {{ row.householdId }}
        </Link>
        <span v-else class="text-xs text-sand-11">—</span>
      </template>

      <template #cell:status="{ row }">
        <span
          class="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold"
          :class="
            row.isDeceased
              ? 'bg-red-50 text-red-700'
              : row.status === 'Active'
                ? 'bg-teal-50 text-teal-700'
                : 'bg-sand-3 text-sand-11'
          "
        >
          {{ row.isDeceased ? 'Deceased' : row.status }}
        </span>
      </template>

      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/patients/${row.patientId}`" title="View patient" variant="view" />
          <TableIconLink :href="`/patients/${row.patientId}/edit`" title="Edit patient" variant="edit" />
        </div>
      </template>
    </DataTable>

    <div
      v-if="pagination.lastPage > 1"
      class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-sand-11"
    >
      <span>
        Page {{ pagination.page }} of {{ pagination.lastPage }}
      </span>
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
