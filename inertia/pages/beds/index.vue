<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

type BedRow = {
  id: number
  bedNumber: string
  wardId: number
  wardName: string | null
  wing: string | null
  status: string
  patientName: string | null
  admittedAt: string | null
  isActive: boolean
}

type WardOption = { id: number; name: string; wing: string }

const props = defineProps<{
  beds: BedRow[]
  wards: WardOption[]
  wings: string[]
  statuses: string[]
  statusCounts: Record<string, number>
  filters: { status: string; wardId: number | null; wing: string | null; search: string }
}>()

const searchInput = ref(props.filters.search ?? '')
const wingFilter = ref(props.filters.wing ?? '')
const wardFilter = ref(props.filters.wardId ? String(props.filters.wardId) : '')

watch(
  () => props.filters,
  (next) => {
    searchInput.value = next.search ?? ''
    wingFilter.value = next.wing ?? ''
    wardFilter.value = next.wardId ? String(next.wardId) : ''
  }
)

const statusMeta: Record<
  string,
  { label: string; tile: string; card: string; text: string; dot: string }
> = {
  available: {
    label: 'Available',
    tile: 'beds-stat beds-stat--available',
    card: 'beds-card beds-card--available',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  occupied: {
    label: 'Occupied',
    tile: 'beds-stat beds-stat--occupied',
    card: 'beds-card beds-card--occupied',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  reserved: {
    label: 'Reserved',
    tile: 'beds-stat beds-stat--reserved',
    card: 'beds-card beds-card--reserved',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  maintenance: {
    label: 'Maintenance',
    tile: 'beds-stat beds-stat--maintenance',
    card: 'beds-card beds-card--maintenance',
    text: 'text-neutral-600 dark:text-neutral-300',
    dot: 'bg-neutral-400',
  },
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: props.statusCounts.all ?? 0 },
  ...props.statuses.map((status) => ({
    key: status,
    label: statusMeta[status]?.label ?? status,
    count: props.statusCounts[status] ?? 0,
  })),
])

const wardsForWing = computed(() => {
  if (!wingFilter.value) return props.wards
  return props.wards.filter((ward) => ward.wing === wingFilter.value)
})

const bedsByWard = computed(() => {
  const groups = new Map<
    number,
    { wardId: number; wardName: string; wing: string | null; beds: BedRow[] }
  >()

  for (const bed of props.beds) {
    const existing = groups.get(bed.wardId)
    if (existing) {
      existing.beds.push(bed)
      continue
    }
    groups.set(bed.wardId, {
      wardId: bed.wardId,
      wardName: bed.wardName ?? 'Unassigned ward',
      wing: bed.wing,
      beds: [bed],
    })
  }

  return [...groups.values()]
})

function buildQuery(overrides: Record<string, string | number | null | undefined> = {}) {
  const params = new URLSearchParams()
  const status = String(overrides.status ?? props.filters.status ?? 'all')
  const wing = overrides.wing === undefined ? wingFilter.value : String(overrides.wing ?? '')
  const wardId =
    overrides.wardId === undefined ? wardFilter.value : String(overrides.wardId ?? '')
  const search =
    overrides.search === undefined ? searchInput.value.trim() : String(overrides.search ?? '')

  if (status && status !== 'all') params.set('status', status)
  else params.set('status', 'all')
  if (wing) params.set('wing', wing)
  if (wardId) params.set('ward_id', wardId)
  if (search) params.set('q', search)
  return params.toString()
}

function go(overrides: Record<string, string | number | null | undefined> = {}) {
  const query = buildQuery(overrides)
  router.get(`/beds?${query}`, {}, { preserveState: true, preserveScroll: true })
}

function onSearchSubmit() {
  go({ search: searchInput.value.trim() })
}

function clearFilters() {
  searchInput.value = ''
  wingFilter.value = ''
  wardFilter.value = ''
  go({ status: 'all', wing: '', wardId: '', search: '' })
}

function wingPillClass(wing: string | null) {
  const key = String(wing ?? '').toLowerCase()
  if (key === 'male') return 'beds-wing-pill beds-wing-pill--male'
  if (key === 'female') return 'beds-wing-pill beds-wing-pill--female'
  if (key === 'paediatric') return 'beds-wing-pill beds-wing-pill--paediatric'
  return 'beds-wing-pill'
}

async function destroy(id: number) {
  if (!(await confirmDialog('Delete this bed?'))) return
  router.delete(`/beds/${id}`)
}

const hasActiveFilters = computed(
  () =>
    Boolean(props.filters.search) ||
    Boolean(props.filters.wing) ||
    Boolean(props.filters.wardId) ||
    (props.filters.status && props.filters.status !== 'all')
)
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Beds</span>
    </template>

    <div class="beds-page w-full space-y-5">
      <header class="beds-page__header">
        <div class="min-w-0 flex-1">
          <h1 class="beds-page__title">Beds</h1>
          <p class="beds-page__description">
            Browse bed capacity by ward and status. Open a bed to manage admission, move, or discharge.
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <Link href="/accessories" class="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            Accessories
          </Link>
          <Link
            :href="filters.wardId ? `/beds/create?ward_id=${filters.wardId}` : '/beds/create'"
            class="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Bed
          </Link>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          v-for="status in statuses"
          :key="status"
          type="button"
          :class="[statusMeta[status].tile, filters.status === status ? 'is-active' : '']"
          @click="go({ status })"
        >
          <div>
            <p class="beds-stat__label">{{ statusMeta[status].label }}</p>
            <p class="beds-stat__value">{{ statusCounts[status] ?? 0 }}</p>
          </div>
          <span class="beds-stat__dot" :class="statusMeta[status].dot" />
        </button>
      </div>

      <div class="beds-tabs" role="tablist" aria-label="Bed status">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="beds-tab"
          :class="{ 'is-active': filters.status === tab.key }"
          :aria-selected="filters.status === tab.key"
          @click="go({ status: tab.key })"
        >
          <span>{{ tab.label }}</span>
          <span class="beds-tab__count">{{ tab.count }}</span>
        </button>
      </div>

      <form class="beds-filters" @submit.prevent="onSearchSubmit">
        <select
          v-model="wingFilter"
          class="field-input"
          aria-label="Filter by wing"
          @change="go({ wing: wingFilter, wardId: '' })"
        >
          <option value="">All wings</option>
          <option v-for="wing in wings" :key="wing" :value="wing">{{ wing }} wing</option>
        </select>

        <select
          v-model="wardFilter"
          class="field-input"
          aria-label="Filter by ward"
          @change="go({ wardId: wardFilter || null })"
        >
          <option value="">All wards</option>
          <option v-for="ward in wardsForWing" :key="ward.id" :value="String(ward.id)">
            {{ ward.name }}
          </option>
        </select>

        <div class="beds-filters__search">
          <input
            v-model="searchInput"
            type="search"
            class="field-input"
            placeholder="Search bed # or patient…"
            aria-label="Search beds"
          />
          <button type="submit" class="btn-primary px-3 py-2 text-sm">Search</button>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="btn-secondary px-3 py-2 text-sm"
            @click="clearFilters"
          >
            Clear
          </button>
        </div>
      </form>

      <div v-if="bedsByWard.length === 0" class="beds-empty">
        <svg class="h-10 w-10 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        <p class="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">No beds match these filters</p>
        <p class="mt-1 text-xs text-neutral-500">Try another status, ward, or search term.</p>
        <button type="button" class="btn-secondary mt-4 px-3 py-2 text-sm" @click="clearFilters">
          Reset filters
        </button>
      </div>

      <section v-for="group in bedsByWard" :key="group.wardId" class="beds-ward">
        <header class="beds-ward__header">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="beds-ward__title">{{ group.wardName }}</h2>
            <span :class="wingPillClass(group.wing)">{{ group.wing || '—' }} wing</span>
            <span class="text-xs text-neutral-500">
              {{ group.beds.length }} {{ group.beds.length === 1 ? 'bed' : 'beds' }}
            </span>
          </div>
          <button
            type="button"
            class="text-xs font-semibold text-neutral-500 transition hover:text-neutral-900 dark:hover:text-neutral-100"
            @click="go({ wardId: group.wardId })"
          >
            View ward only
          </button>
        </header>

        <div class="beds-grid">
          <article
            v-for="bed in group.beds"
            :key="bed.id"
            :class="statusMeta[bed.status]?.card || 'beds-card'"
          >
            <Link :href="`/beds/${bed.id}`" class="beds-card__main">
              <div class="flex items-start justify-between gap-2">
                <p class="beds-card__number">{{ bed.bedNumber }}</p>
                <span class="beds-card__status" :class="statusMeta[bed.status]?.text">
                  <span class="beds-card__dot" :class="statusMeta[bed.status]?.dot" />
                  {{ statusMeta[bed.status]?.label || bed.status }}
                </span>
              </div>

              <p v-if="bed.status === 'occupied'" class="beds-card__patient" :title="bed.patientName || undefined">
                {{ bed.patientName || 'Patient not named' }}
              </p>
              <p v-else class="beds-card__patient beds-card__patient--empty">No patient</p>

              <p v-if="bed.admittedAt" class="beds-card__meta">Admitted {{ bed.admittedAt }}</p>
              <p v-else-if="!bed.isActive" class="beds-card__meta">Inactive</p>
            </Link>

            <div class="beds-card__actions">
              <TableIconLink :href="`/beds/${bed.id}`" title="Open bed" variant="view" />
              <TableIconLink :href="`/beds/${bed.id}/edit`" title="Edit bed" variant="edit" />
              <TableIconButton variant="delete" tone="danger" title="Delete bed" @click="destroy(bed.id)" />
            </div>
          </article>
        </div>
      </section>
    </div>
  </StaffLayout>
</template>
