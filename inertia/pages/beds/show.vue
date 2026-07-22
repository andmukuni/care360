<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

type WardBed = {
  id: number
  bedNumber: string
  status: string
  patientName: string | null
  isCurrent: boolean
}

const props = defineProps<{
  bed: {
    id: number
    bedNumber: string
    wardId: number
    wardName: string | null
    wing: string | null
    status: string
    encounterId: number | null
    patientName: string | null
    admittedAt: string | null
    dischargedAt: string | null
    notes: string | null
    isActive: boolean
    patient: { id: number; patientId: string; fullName: string } | null
    accessories: {
      id: number
      name: string | null
      assetTag: string | null
      status: string
      type: string | null
    }[]
    assignments: {
      id: number
      patientName: string | null
      admittedAt: string | null
      dischargedAt: string | null
      admittedBy: string | null
      dischargedBy: string | null
    }[]
  }
  wardBeds: WardBed[]
  allWardsWithBeds: {
    id: number
    name: string
    wing: string
    beds: { id: number; bedNumber: string }[]
  }[]
  statuses: string[]
}>()

const discharging = ref(false)
const showMove = ref(false)
const showStatus = ref(false)

const statusMeta: Record<
  string,
  { label: string; card: string; text: string; dot: string; panel: string; tile: string }
> = {
  available: {
    label: 'Available',
    card: 'beds-card beds-card--available',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    panel: 'bed-show-hero bed-show-hero--available',
    tile: 'beds-stat beds-stat--available',
  },
  occupied: {
    label: 'Occupied',
    card: 'beds-card beds-card--occupied',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    panel: 'bed-show-hero bed-show-hero--occupied',
    tile: 'beds-stat beds-stat--occupied',
  },
  reserved: {
    label: 'Reserved',
    card: 'beds-card beds-card--reserved',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    panel: 'bed-show-hero bed-show-hero--reserved',
    tile: 'beds-stat beds-stat--reserved',
  },
  maintenance: {
    label: 'Maintenance',
    card: 'beds-card beds-card--maintenance',
    text: 'text-neutral-600 dark:text-neutral-300',
    dot: 'bg-neutral-400',
    panel: 'bed-show-hero bed-show-hero--maintenance',
    tile: 'beds-stat beds-stat--maintenance',
  },
}

const currentMeta = computed(() => statusMeta[props.bed.status] ?? statusMeta.maintenance)
const displayPatient = computed(
  () => props.bed.patient?.fullName ?? props.bed.patientName ?? null
)

const statusForm = useForm({
  status: props.bed.status,
  patient_name: props.bed.patientName ?? '',
  notes: props.bed.notes ?? '',
})

const moveForm = useForm({
  ward_id: props.bed.wardId,
  bed_number: props.bed.bedNumber,
  reason: '',
})

function wingPillClass(wing: string | null) {
  const key = String(wing ?? '').toLowerCase()
  if (key === 'male') return 'beds-wing-pill beds-wing-pill--male'
  if (key === 'female') return 'beds-wing-pill beds-wing-pill--female'
  if (key === 'paediatric') return 'beds-wing-pill beds-wing-pill--paediatric'
  return 'beds-wing-pill'
}

function siblingCardClass(status: string, isCurrent: boolean) {
  const base = statusMeta[status]?.card || 'beds-card'
  return isCurrent ? `${base} bed-show-sibling is-current` : `${base} bed-show-sibling`
}

function submitStatus() {
  statusForm.patch(`/beds/${props.bed.id}/status`, {
    preserveScroll: true,
    onSuccess: () => {
      showStatus.value = false
    },
  })
}

function submitMove() {
  moveForm.patch(`/beds/${props.bed.id}/move`, {
    preserveScroll: true,
    onSuccess: () => {
      showMove.value = false
    },
  })
}

async function discharge() {
  const name = displayPatient.value || 'this patient'
  if (
    !(await confirmDialog(
      `Discharge ${name} from bed ${props.bed.bedNumber}? The bed will become available.`
    ))
  ) {
    return
  }
  discharging.value = true
  router.post(
    `/beds/${props.bed.id}/discharge`,
    {},
    {
      preserveScroll: true,
      onFinish: () => {
        discharging.value = false
      },
    }
  )
}

async function setStatusQuick(status: string) {
  if (status === props.bed.status) return
  if (status === 'available' && props.bed.status === 'occupied') {
    await discharge()
    return
  }
  if (status === 'occupied') {
    statusForm.status = 'occupied'
    showStatus.value = true
    showMove.value = false
    return
  }
  if (
    !(await confirmDialog({
      title: 'Change bed status',
      message: `Set bed ${props.bed.bedNumber} to ${statusMeta[status]?.label ?? status}?`,
      confirmLabel: 'Update status',
      variant: status === 'maintenance' ? 'warning' : 'primary',
    }))
  ) {
    return
  }
  statusForm.status = status
  statusForm.patient_name = ''
  submitStatus()
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/beds" class="hover:underline">Beds</Link>
      <span class="mx-2">/</span>
      <Link :href="`/wards/${bed.wardId}`" class="hover:underline">{{ bed.wardName ?? 'Ward' }}</Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ bed.bedNumber }}</span>
    </template>

    <div class="beds-page bed-show w-full space-y-5">
      <header class="beds-page__header">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="beds-page__title">Bed {{ bed.bedNumber }}</h1>
            <span :class="wingPillClass(bed.wing)">{{ bed.wing || '—' }} wing</span>
            <span class="beds-card__status" :class="currentMeta.text">
              <span class="beds-card__dot" :class="currentMeta.dot" />
              {{ currentMeta.label }}
            </span>
            <span
              class="beds-wing-pill"
              :class="bed.isActive ? 'ward-chip--available' : 'ward-chip--inactive'"
            >
              {{ bed.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <p class="beds-page__description">
            {{ bed.wardName ?? 'Unassigned ward' }}
            <template v-if="displayPatient"> · {{ displayPatient }}</template>
            <template v-else> · No patient assigned</template>
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            v-if="bed.status === 'occupied'"
            type="button"
            class="ward-discharge-btn"
            :disabled="discharging"
            @click="discharge"
          >
            {{ discharging ? 'Discharging…' : 'Discharge' }}
          </button>
          <Link :href="`/beds/${bed.id}/edit`" class="btn-secondary px-3 py-2 text-sm">Edit</Link>
          <Link :href="`/wards/${bed.wardId}`" class="btn-secondary px-3 py-2 text-sm">Ward</Link>
          <Link href="/beds" class="btn-secondary px-3 py-2 text-sm">All beds</Link>
        </div>
      </header>

      <section :class="currentMeta.panel">
        <div class="min-w-0 flex-1 space-y-3">
          <div>
            <p class="beds-stat__label">Current occupancy</p>
            <p class="bed-show-hero__patient">
              {{ displayPatient || 'No patient in this bed' }}
            </p>
          </div>
          <dl class="bed-show-meta">
            <div>
              <dt>Admitted</dt>
              <dd>{{ bed.admittedAt || '—' }}</dd>
            </div>
            <div>
              <dt>Last discharged</dt>
              <dd>{{ bed.dischargedAt || '—' }}</dd>
            </div>
            <div>
              <dt>Ward</dt>
              <dd>{{ bed.wardName || '—' }}</dd>
            </div>
            <div>
              <dt>Accessories</dt>
              <dd>{{ bed.accessories.length }}</dd>
            </div>
          </dl>
          <p v-if="bed.notes" class="bed-show-notes">{{ bed.notes }}</p>
        </div>

        <div class="bed-show-hero__actions">
          <Link
            v-if="bed.encounterId"
            :href="`/encounters/${bed.encounterId}`"
            class="btn-primary px-3 py-2 text-sm"
          >
            Open encounter
          </Link>
          <Link
            v-if="bed.patient?.patientId"
            :href="`/patients/${bed.patient.patientId}`"
            class="btn-secondary px-3 py-2 text-sm"
          >
            Patient chart
          </Link>
          <button
            v-if="bed.status === 'occupied'"
            type="button"
            class="ward-discharge-btn"
            :disabled="discharging"
            @click="discharge"
          >
            {{ discharging ? 'Discharging…' : 'Discharge patient' }}
          </button>
          <button type="button" class="btn-secondary px-3 py-2 text-sm" @click="showStatus = !showStatus">
            {{ showStatus ? 'Hide status form' : 'Change status' }}
          </button>
          <button type="button" class="btn-secondary px-3 py-2 text-sm" @click="showMove = !showMove">
            {{ showMove ? 'Hide move form' : 'Move bed' }}
          </button>
        </div>
      </section>

      <div class="bed-show-quick-status">
        <p class="beds-stat__label">Quick status</p>
        <div class="bed-show-quick-status__row">
          <button
            v-for="status in statuses"
            :key="status"
            type="button"
            :class="[statusMeta[status]?.tile || 'beds-stat beds-stat--maintenance', { 'is-active': bed.status === status }]"
            :disabled="statusForm.processing || bed.status === status"
            @click="setStatusQuick(status)"
          >
            <div>
              <p class="beds-stat__label">{{ statusMeta[status]?.label || status }}</p>
              <p class="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {{ bed.status === status ? 'Current' : 'Set' }}
              </p>
            </div>
            <span class="beds-stat__dot" :class="statusMeta[status]?.dot" />
          </button>
        </div>
      </div>

      <div v-if="showStatus || showMove" class="grid gap-4 lg:grid-cols-2">
        <form
          v-if="showStatus"
          class="bed-show-panel space-y-3"
          @submit.prevent="submitStatus"
        >
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Change status</h2>
          <select v-model="statusForm.status" class="field-input w-full capitalize">
            <option v-for="s in statuses" :key="s" :value="s">{{ statusMeta[s]?.label || s }}</option>
          </select>
          <input
            v-if="statusForm.status === 'occupied'"
            v-model="statusForm.patient_name"
            type="text"
            placeholder="Patient name"
            class="field-input w-full"
          />
          <textarea
            v-model="statusForm.notes"
            rows="3"
            placeholder="Notes (optional)"
            class="field-input w-full"
          />
          <p v-if="statusForm.errors.status" class="text-sm text-red-600">{{ statusForm.errors.status }}</p>
          <ActionButton type="submit" variant="blue" :loading="statusForm.processing" loading-text="Saving…">
            Update status
          </ActionButton>
        </form>

        <form v-if="showMove" class="bed-show-panel space-y-3" @submit.prevent="submitMove">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Move to another ward</h2>
          <select v-model="moveForm.ward_id" class="field-input w-full">
            <option v-for="w in allWardsWithBeds" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.wing }})
            </option>
          </select>
          <input
            v-model="moveForm.bed_number"
            type="text"
            placeholder="Bed number"
            class="field-input w-full"
          />
          <input
            v-model="moveForm.reason"
            type="text"
            placeholder="Reason (optional)"
            class="field-input w-full"
          />
          <p v-if="moveForm.errors.ward_id" class="text-sm text-red-600">{{ moveForm.errors.ward_id }}</p>
          <p v-if="moveForm.errors.bed_number" class="text-sm text-red-600">{{ moveForm.errors.bed_number }}</p>
          <ActionButton type="submit" variant="outline" :loading="moveForm.processing" loading-text="Moving…">
            Move bed
          </ActionButton>
        </form>
      </div>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Beds in {{ bed.wardName ?? 'this ward' }}
            </h2>
            <p class="text-xs text-neutral-500">Jump to another bed in the same ward.</p>
          </div>
          <Link :href="`/wards/${bed.wardId}`" class="btn-secondary px-3 py-1.5 text-xs">Manage ward</Link>
        </div>

        <div class="beds-grid">
          <article
            v-for="row in wardBeds"
            :key="row.id"
            :class="siblingCardClass(row.status, row.isCurrent)"
          >
            <component
              :is="row.isCurrent ? 'div' : Link"
              :href="row.isCurrent ? undefined : `/beds/${row.id}`"
              class="beds-card__main"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="beds-card__number">{{ row.bedNumber }}</p>
                <span class="beds-card__status" :class="statusMeta[row.status]?.text">
                  <span class="beds-card__dot" :class="statusMeta[row.status]?.dot" />
                  {{ statusMeta[row.status]?.label || row.status }}
                </span>
              </div>
              <p
                class="beds-card__patient"
                :class="{ 'beds-card__patient--empty': !row.patientName && !row.isCurrent }"
              >
                <template v-if="row.isCurrent">This bed</template>
                <template v-else-if="row.patientName">{{ row.patientName }}</template>
                <template v-else>No patient</template>
              </p>
            </component>
          </article>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <div class="bed-show-panel">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Accessories</h2>
            <Link href="/accessories" class="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
              Manage
            </Link>
          </div>
          <div v-if="bed.accessories.length === 0" class="beds-empty !py-8">
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">No accessories attached</p>
          </div>
          <ul v-else class="bed-show-list">
            <li v-for="item in bed.accessories" :key="item.id" class="bed-show-list__row">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ item.name || item.type || 'Accessory' }}
                </p>
                <p class="truncate text-xs text-neutral-500">
                  <template v-if="item.type">{{ item.type }} · </template>
                  {{ item.assetTag || 'No asset tag' }}
                </p>
              </div>
              <span class="ward-chip capitalize">{{ item.status }}</span>
            </li>
          </ul>
        </div>

        <div class="bed-show-panel">
          <h2 class="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Assignment history</h2>
          <div v-if="bed.assignments.length === 0" class="beds-empty !py-8">
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">No assignment history</p>
          </div>
          <ul v-else class="bed-show-list">
            <li v-for="row in bed.assignments" :key="row.id" class="bed-show-list__row bed-show-list__row--stack">
              <div class="flex w-full items-start justify-between gap-2">
                <p class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ row.patientName || 'Unnamed patient' }}
                </p>
                <span
                  class="ward-chip shrink-0"
                  :class="row.dischargedAt ? 'ward-chip--inactive' : 'ward-chip--occupied'"
                >
                  {{ row.dischargedAt ? 'Discharged' : 'Current' }}
                </span>
              </div>
              <p class="w-full text-xs text-neutral-500">
                Admitted {{ row.admittedAt || '—' }}
                <template v-if="row.admittedBy"> · by {{ row.admittedBy }}</template>
              </p>
              <p v-if="row.dischargedAt" class="w-full text-xs text-neutral-500">
                Discharged {{ row.dischargedAt }}
                <template v-if="row.dischargedBy"> · by {{ row.dischargedBy }}</template>
              </p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </StaffLayout>
</template>
