<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import { confirmDialog } from '~/composables/useConfirm'

type BedRow = {
  id: number
  bedNumber: string
  status: string
  patientName: string | null
  admittedAt: string | null
  isActive: boolean
}

const props = defineProps<{
  ward: {
    id: number
    name: string
    type: string
    wing: string
    location: string | null
    notes: string | null
    isActive: boolean
    bedsCount: number
    availableBedsCount: number
    occupiedBedsCount: number
    reservedBedsCount: number
    maintenanceBedsCount: number
  }
  beds: BedRow[]
}>()

const statusFilter = ref<'all' | 'available' | 'occupied' | 'reserved' | 'maintenance'>('all')
const dischargingId = ref<number | null>(null)

const statusMeta: Record<
  string,
  { label: string; card: string; text: string; dot: string }
> = {
  available: {
    label: 'Available',
    card: 'beds-card beds-card--available',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  occupied: {
    label: 'Occupied',
    card: 'beds-card beds-card--occupied',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  reserved: {
    label: 'Reserved',
    card: 'beds-card beds-card--reserved',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  maintenance: {
    label: 'Maintenance',
    card: 'beds-card beds-card--maintenance',
    text: 'text-neutral-600 dark:text-neutral-300',
    dot: 'bg-neutral-400',
  },
}

const tabs = computed(() => [
  { key: 'all' as const, label: 'All', count: props.ward.bedsCount },
  { key: 'available' as const, label: 'Available', count: props.ward.availableBedsCount },
  { key: 'occupied' as const, label: 'Occupied', count: props.ward.occupiedBedsCount },
  { key: 'reserved' as const, label: 'Reserved', count: props.ward.reservedBedsCount },
  { key: 'maintenance' as const, label: 'Maintenance', count: props.ward.maintenanceBedsCount },
])

const filteredBeds = computed(() => {
  if (statusFilter.value === 'all') return props.beds
  return props.beds.filter((bed) => bed.status === statusFilter.value)
})

const occupiedBeds = computed(() => props.beds.filter((bed) => bed.status === 'occupied'))

function wingPillClass(wing: string | null) {
  const key = String(wing ?? '').toLowerCase()
  if (key === 'male') return 'beds-wing-pill beds-wing-pill--male'
  if (key === 'female') return 'beds-wing-pill beds-wing-pill--female'
  if (key === 'paediatric') return 'beds-wing-pill beds-wing-pill--paediatric'
  return 'beds-wing-pill'
}

async function discharge(bed: BedRow) {
  if (
    !(await confirmDialog(
      `Discharge ${bed.patientName || 'this patient'} from bed ${bed.bedNumber}? The bed will become available.`
    ))
  ) {
    return
  }
  dischargingId.value = bed.id
  router.post(
    `/beds/${bed.id}/discharge`,
    {},
    {
      preserveScroll: true,
      onFinish: () => {
        dischargingId.value = null
      },
    }
  )
}

async function destroyWard() {
  if (!(await confirmDialog('Delete this ward?'))) return
  router.delete(`/wards/${props.ward.id}`)
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/wards" class="hover:underline">Wards</Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ ward.name }}</span>
    </template>

    <div class="wards-page w-full space-y-5">
      <header class="beds-page__header">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="beds-page__title">{{ ward.name }}</h1>
            <span :class="wingPillClass(ward.wing)">{{ ward.wing }} wing</span>
            <span
              class="beds-wing-pill"
              :class="ward.isActive ? 'ward-chip--available' : 'ward-chip--inactive'"
            >
              {{ ward.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <p class="beds-page__description">
            {{ ward.type }}
            <template v-if="ward.location"> · {{ ward.location }}</template>
            <template v-if="ward.notes"> · {{ ward.notes }}</template>
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <Link :href="`/beds/create?ward_id=${ward.id}`" class="btn-primary px-3 py-2 text-sm">
            Add bed
          </Link>
          <Link :href="`/wards/${ward.id}/edit`" class="btn-secondary px-3 py-2 text-sm">Edit ward</Link>
          <Link href="/wards" class="btn-secondary px-3 py-2 text-sm">Back</Link>
          <button type="button" class="btn-secondary px-3 py-2 text-sm text-red-700" @click="destroyWard">
            Delete
          </button>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div class="beds-stat beds-stat--maintenance">
          <div>
            <p class="beds-stat__label">Total</p>
            <p class="beds-stat__value">{{ ward.bedsCount }}</p>
          </div>
        </div>
        <button type="button" class="beds-stat beds-stat--available" @click="statusFilter = 'available'">
          <div>
            <p class="beds-stat__label">Available</p>
            <p class="beds-stat__value">{{ ward.availableBedsCount }}</p>
          </div>
          <span class="beds-stat__dot bg-emerald-500" />
        </button>
        <button type="button" class="beds-stat beds-stat--occupied" @click="statusFilter = 'occupied'">
          <div>
            <p class="beds-stat__label">Occupied</p>
            <p class="beds-stat__value">{{ ward.occupiedBedsCount }}</p>
          </div>
          <span class="beds-stat__dot bg-red-500" />
        </button>
        <button type="button" class="beds-stat beds-stat--reserved" @click="statusFilter = 'reserved'">
          <div>
            <p class="beds-stat__label">Reserved</p>
            <p class="beds-stat__value">{{ ward.reservedBedsCount }}</p>
          </div>
          <span class="beds-stat__dot bg-amber-500" />
        </button>
        <button type="button" class="beds-stat beds-stat--maintenance" @click="statusFilter = 'maintenance'">
          <div>
            <p class="beds-stat__label">Maintenance</p>
            <p class="beds-stat__value">{{ ward.maintenanceBedsCount }}</p>
          </div>
          <span class="beds-stat__dot bg-neutral-400" />
        </button>
      </div>

      <div v-if="occupiedBeds.length" class="ward-discharge-panel">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Patients in this ward</h2>
          <p class="mt-0.5 text-xs text-neutral-500">
            Discharge frees the bed immediately and clears the ward assignment on the encounter.
          </p>
        </div>
        <div class="ward-discharge-list">
          <div v-for="bed in occupiedBeds" :key="bed.id" class="ward-discharge-row">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {{ bed.patientName || 'Unnamed patient' }}
              </p>
              <p class="truncate text-xs text-neutral-500">
                Bed {{ bed.bedNumber }}
                <template v-if="bed.admittedAt"> · admitted {{ bed.admittedAt }}</template>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Link :href="`/beds/${bed.id}`" class="btn-secondary px-2.5 py-1.5 text-xs">Open bed</Link>
              <button
                type="button"
                class="ward-discharge-btn"
                :disabled="dischargingId === bed.id"
                @click="discharge(bed)"
              >
                {{ dischargingId === bed.id ? 'Discharging…' : 'Discharge' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="beds-tabs" role="tablist" aria-label="Bed status">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="beds-tab"
          :class="{ 'is-active': statusFilter === tab.key }"
          :aria-selected="statusFilter === tab.key"
          @click="statusFilter = tab.key"
        >
          <span>{{ tab.label }}</span>
          <span class="beds-tab__count">{{ tab.count }}</span>
        </button>
      </div>

      <div v-if="filteredBeds.length === 0" class="beds-empty">
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">No beds in this view</p>
        <p class="mt-1 text-xs text-neutral-500">Add a bed to this ward or choose another status filter.</p>
        <Link :href="`/beds/create?ward_id=${ward.id}`" class="btn-primary mt-4 px-3 py-2 text-sm">
          Add bed
        </Link>
      </div>

      <div v-else class="beds-grid">
        <article
          v-for="bed in filteredBeds"
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
            <p v-if="bed.status === 'occupied'" class="beds-card__patient">
              {{ bed.patientName || 'Patient not named' }}
            </p>
            <p v-else class="beds-card__patient beds-card__patient--empty">No patient</p>
            <p v-if="bed.admittedAt" class="beds-card__meta">Admitted {{ bed.admittedAt }}</p>
          </Link>

          <div class="beds-card__actions">
            <TableIconLink :href="`/beds/${bed.id}`" title="Open bed" variant="view" />
            <TableIconLink :href="`/beds/${bed.id}/edit`" title="Edit bed" variant="edit" />
            <button
              v-if="bed.status === 'occupied'"
              type="button"
              class="ward-discharge-btn ward-discharge-btn--compact"
              :disabled="dischargingId === bed.id"
              @click="discharge(bed)"
            >
              {{ dischargingId === bed.id ? '…' : 'Discharge' }}
            </button>
          </div>
        </article>
      </div>
    </div>
  </StaffLayout>
</template>
