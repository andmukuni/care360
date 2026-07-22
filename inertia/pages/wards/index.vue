<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

type WardRow = {
  id: number
  name: string
  wing: string
  type: string
  location: string | null
  notes: string | null
  bedsCount: number
  availableBedsCount: number
  occupiedBedsCount: number
  reservedBedsCount: number
  maintenanceBedsCount: number
  isActive: boolean
}

const props = defineProps<{
  wards: WardRow[]
  wings: string[]
  filters: { wing: string | null; search: string; active: string }
  totals: {
    wards: number
    beds: number
    available: number
    occupied: number
    reserved: number
    maintenance: number
  }
}>()

const searchInput = ref(props.filters.search ?? '')
const wingFilter = ref(props.filters.wing ?? '')
const activeFilter = ref(props.filters.active ?? 'all')

watch(
  () => props.filters,
  (next) => {
    searchInput.value = next.search ?? ''
    wingFilter.value = next.wing ?? ''
    activeFilter.value = next.active ?? 'all'
  }
)

const wardsByWing = computed(() => {
  const groups = new Map<string, WardRow[]>()
  for (const ward of props.wards) {
    const key = ward.wing || 'Other'
    const list = groups.get(key) ?? []
    list.push(ward)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([wing, wards]) => ({ wing, wards }))
})

function buildQuery(overrides: Record<string, string | null | undefined> = {}) {
  const params = new URLSearchParams()
  const wing = overrides.wing === undefined ? wingFilter.value : String(overrides.wing ?? '')
  const active =
    overrides.active === undefined ? activeFilter.value : String(overrides.active ?? 'all')
  const search =
    overrides.search === undefined ? searchInput.value.trim() : String(overrides.search ?? '')

  if (wing) params.set('wing', wing)
  if (active && active !== 'all') params.set('active', active)
  if (search) params.set('q', search)
  return params.toString()
}

function go(overrides: Record<string, string | null | undefined> = {}) {
  const query = buildQuery(overrides)
  router.get(query ? `/wards?${query}` : '/wards', {}, { preserveState: true, preserveScroll: true })
}

function onSearchSubmit() {
  go({ search: searchInput.value.trim() })
}

function clearFilters() {
  searchInput.value = ''
  wingFilter.value = ''
  activeFilter.value = 'all'
  go({ wing: '', search: '', active: 'all' })
}

function destroy(id: number) {
  if (confirm('Delete this ward?')) {
    router.delete(`/wards/${id}`)
  }
}

function wingPillClass(wing: string | null) {
  const key = String(wing ?? '').toLowerCase()
  if (key === 'male') return 'beds-wing-pill beds-wing-pill--male'
  if (key === 'female') return 'beds-wing-pill beds-wing-pill--female'
  if (key === 'paediatric') return 'beds-wing-pill beds-wing-pill--paediatric'
  return 'beds-wing-pill'
}

function occupancyPercent(ward: WardRow) {
  if (!ward.bedsCount) return 0
  return Math.round((ward.occupiedBedsCount / ward.bedsCount) * 100)
}

const hasActiveFilters = computed(
  () =>
    Boolean(props.filters.search) ||
    Boolean(props.filters.wing) ||
    (props.filters.active && props.filters.active !== 'all')
)
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Wards</span>
    </template>

    <div class="wards-page w-full space-y-5">
      <header class="beds-page__header">
        <div class="min-w-0 flex-1">
          <h1 class="beds-page__title">Wards</h1>
          <p class="beds-page__description">
            Manage ward capacity and open a ward to admit, move, or discharge patients from its beds.
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <Link href="/beds" class="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            All beds
          </Link>
          <Link href="/wards/create" class="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Ward
          </Link>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div class="beds-stat beds-stat--maintenance">
          <div>
            <p class="beds-stat__label">Wards</p>
            <p class="beds-stat__value">{{ totals.wards }}</p>
          </div>
        </div>
        <div class="beds-stat beds-stat--maintenance">
          <div>
            <p class="beds-stat__label">Beds</p>
            <p class="beds-stat__value">{{ totals.beds }}</p>
          </div>
        </div>
        <div class="beds-stat beds-stat--available">
          <div>
            <p class="beds-stat__label">Available</p>
            <p class="beds-stat__value">{{ totals.available }}</p>
          </div>
          <span class="beds-stat__dot bg-emerald-500" />
        </div>
        <div class="beds-stat beds-stat--occupied">
          <div>
            <p class="beds-stat__label">Occupied</p>
            <p class="beds-stat__value">{{ totals.occupied }}</p>
          </div>
          <span class="beds-stat__dot bg-red-500" />
        </div>
        <div class="beds-stat beds-stat--reserved">
          <div>
            <p class="beds-stat__label">Reserved</p>
            <p class="beds-stat__value">{{ totals.reserved }}</p>
          </div>
          <span class="beds-stat__dot bg-amber-500" />
        </div>
        <div class="beds-stat beds-stat--maintenance">
          <div>
            <p class="beds-stat__label">Maintenance</p>
            <p class="beds-stat__value">{{ totals.maintenance }}</p>
          </div>
          <span class="beds-stat__dot bg-neutral-400" />
        </div>
      </div>

      <form class="beds-filters wards-filters" @submit.prevent="onSearchSubmit">
        <select
          v-model="wingFilter"
          class="field-input"
          aria-label="Filter by wing"
          @change="go({ wing: wingFilter })"
        >
          <option value="">All wings</option>
          <option v-for="wing in wings" :key="wing" :value="wing">{{ wing }} wing</option>
        </select>

        <select
          v-model="activeFilter"
          class="field-input"
          aria-label="Filter by active state"
          @change="go({ active: activeFilter })"
        >
          <option value="all">All wards</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>

        <div class="beds-filters__search">
          <input
            v-model="searchInput"
            type="search"
            class="field-input"
            placeholder="Search ward, type, or location…"
            aria-label="Search wards"
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

      <div v-if="wardsByWing.length === 0" class="beds-empty">
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">No wards match these filters</p>
        <p class="mt-1 text-xs text-neutral-500">Try another wing or search term.</p>
        <button type="button" class="btn-secondary mt-4 px-3 py-2 text-sm" @click="clearFilters">
          Reset filters
        </button>
      </div>

      <section v-for="group in wardsByWing" :key="group.wing" class="beds-ward">
        <header class="beds-ward__header">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="beds-ward__title">{{ group.wing }} wing</h2>
            <span :class="wingPillClass(group.wing)">{{ group.wards.length }} wards</span>
          </div>
        </header>

        <div class="wards-grid">
          <article
            v-for="ward in group.wards"
            :key="ward.id"
            class="ward-card"
            :class="{ 'ward-card--inactive': !ward.isActive }"
          >
            <Link :href="`/wards/${ward.id}`" class="ward-card__main">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="ward-card__title">{{ ward.name }}</p>
                  <p class="ward-card__meta">
                    {{ ward.type }}
                    <template v-if="ward.location"> · {{ ward.location }}</template>
                  </p>
                </div>
                <span :class="wingPillClass(ward.wing)">{{ ward.wing }}</span>
              </div>

              <div class="ward-card__occupancy">
                <div class="ward-card__occupancy-bar">
                  <span
                    class="ward-card__occupancy-fill"
                    :style="{ width: `${occupancyPercent(ward)}%` }"
                  />
                </div>
                <p class="ward-card__occupancy-label">
                  {{ ward.occupiedBedsCount }}/{{ ward.bedsCount }} occupied
                  <span v-if="ward.bedsCount">({{ occupancyPercent(ward) }}%)</span>
                </p>
              </div>

              <div class="ward-card__stats">
                <span class="ward-chip ward-chip--available">{{ ward.availableBedsCount }} free</span>
                <span class="ward-chip ward-chip--occupied">{{ ward.occupiedBedsCount }} in use</span>
                <span v-if="ward.reservedBedsCount" class="ward-chip ward-chip--reserved">
                  {{ ward.reservedBedsCount }} reserved
                </span>
              </div>
            </Link>

            <div class="beds-card__actions">
              <TableIconLink :href="`/wards/${ward.id}`" title="Manage ward" variant="view" />
              <TableIconLink :href="`/beds?ward_id=${ward.id}`" title="View beds" variant="open" />
              <TableIconLink :href="`/wards/${ward.id}/edit`" title="Edit ward" variant="edit" />
              <TableIconButton variant="delete" tone="danger" title="Delete ward" @click="destroy(ward.id)" />
            </div>
          </article>
        </div>
      </section>
    </div>
  </StaffLayout>
</template>
