<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface Doctor {
  id: number
  name: string
  specialty: string
  bio: string | null
  rating: number
  patientsCount: number | null
  yearsExperience: number | null
  reviewCount: number | null
  sessionFee: number | null
  photoUrl: string | null
  photoPath: string | null
  resolvedPhotoUrl: string | null
  sortOrder: number
  isActive: boolean
}

const props = defineProps<{ doctors: Doctor[] }>()

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filterForm = reactive({
  search: '',
  specialty: '',
  status: '',
})

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Hidden' },
]

const specialtyOptions = computed(() =>
  [...new Set(props.doctors.map((d) => d.specialty))].sort((a, b) => a.localeCompare(b))
)

const hasFilters = computed(() =>
  Object.values(filterForm).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  if (filterForm.specialty) chips.push({ key: 'specialty', label: `Specialty: ${filterForm.specialty}` })
  if (filterForm.status) {
    chips.push({
      key: 'status',
      label: `Status: ${statusOptions.find((o) => o.value === filterForm.status)?.label ?? filterForm.status}`,
    })
  }

  return chips
})

function clearFilters() {
  filterForm.search = ''
  filterForm.specialty = ''
  filterForm.status = ''
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = ''
}

const filteredDoctors = computed(() => {
  let list = props.doctors
  const term = filterForm.search.trim().toLowerCase()

  if (term) {
    list = list.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.specialty.toLowerCase().includes(term) ||
        (d.bio?.toLowerCase().includes(term) ?? false)
    )
  }
  if (filterForm.specialty) list = list.filter((d) => d.specialty === filterForm.specialty)
  if (filterForm.status === 'active') list = list.filter((d) => d.isActive)
  if (filterForm.status === 'inactive') list = list.filter((d) => !d.isActive)

  return list
})

const activeCount = computed(() => props.doctors.filter((d) => d.isActive).length)

const avgRating = computed(() => {
  if (!props.doctors.length) return '—'
  const total = props.doctors.reduce((sum, d) => sum + d.rating, 0)
  return (total / props.doctors.length).toFixed(1)
})

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Total doctors',
    value: String(props.doctors.length),
    meta: 'In featured directory',
    tone: 'sky',
  },
  {
    key: 'active',
    label: 'On portal',
    value: String(activeCount.value),
    meta: 'Shown on home carousel and doctor list',
    tone: 'teal',
  },
  {
    key: 'rating',
    label: 'Average rating',
    value: avgRating.value,
    meta: 'Across all featured profiles',
    tone: 'violet',
  },
  {
    key: 'specialties',
    label: 'Specialties',
    value: String(specialtyOptions.value.length),
    meta: 'Distinct clinical areas',
    tone: 'amber',
  },
])

const kpiCardClass: Record<string, string> = {
  sky: 'border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white dark:border-sky-900/50 dark:from-sky-950/35 dark:via-neutral-950 dark:to-neutral-950',
  violet:
    'border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-white dark:border-violet-900/50 dark:from-violet-950/30 dark:via-neutral-950 dark:to-neutral-950',
  teal: 'border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-white dark:border-teal-900/50 dark:from-teal-950/30 dark:via-neutral-950 dark:to-neutral-950',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-white dark:border-amber-900/50 dark:from-amber-950/25 dark:via-neutral-950 dark:to-neutral-950',
}

const kpiIconClass: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

const kpiValueClass: Record<string, string> = {
  sky: 'text-slate-900 dark:text-neutral-100',
  violet: 'text-violet-800 dark:text-violet-300',
  teal: 'text-teal-800 dark:text-teal-300',
  amber: 'text-amber-800 dark:text-amber-300',
}

const showForm = ref(false)
const editingId = ref<number | null>(null)

const form = useForm({
  name: '',
  specialty: '',
  bio: '',
  rating: 5,
  patients_count: null as number | null,
  years_experience: null as number | null,
  review_count: null as number | null,
  session_fee: null as number | null,
  photo_url: '',
  sort_order: 0,
  is_active: true,
})

function openCreate() {
  editingId.value = null
  form.reset()
  form.clearErrors()
  showForm.value = true
}

function openEdit(d: Doctor) {
  editingId.value = d.id
  form.clearErrors()
  form.name = d.name
  form.specialty = d.specialty
  form.bio = d.bio ?? ''
  form.rating = d.rating
  form.patients_count = d.patientsCount
  form.years_experience = d.yearsExperience
  form.review_count = d.reviewCount
  form.session_fee = d.sessionFee
  form.photo_url = d.photoUrl ?? ''
  form.sort_order = d.sortOrder
  form.is_active = d.isActive
  showForm.value = true
}

function submit() {
  if (editingId.value) {
    form.put(`/featured-doctors/${editingId.value}`, { onSuccess: () => (showForm.value = false) })
  } else {
    form.post('/featured-doctors', { onSuccess: () => (showForm.value = false) })
  }
}

function destroy(d: Doctor) {
  if (confirm(`Delete ${d.name}?`)) {
    router.delete(`/featured-doctors/${d.id}`, { preserveScroll: true })
  }
}

function doctorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'DR'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Featured Doctors</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Manage doctors shown on the patient portal home carousel and doctor directory.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        @click="openCreate"
      >
        New Doctor
      </button>
    </div>

    <div class="card mb-4 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Patient portal</p>
      <p class="mt-1 text-sm text-blue-900 dark:text-blue-200">
        {{ activeCount }} active doctor{{ activeCount === 1 ? '' : 's' }} appear on the home screen and doctor list.
      </p>
    </div>

    <!-- KPI strip -->
    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="card in kpiCards"
        :key="card.key"
        class="rounded-xl border p-4 shadow-sm"
        :class="kpiCardClass[card.tone]"
      >
        <div class="mb-2 flex items-center gap-2.5">
          <span
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="kpiIconClass[card.tone]"
            aria-hidden="true"
          >
            <svg v-if="card.key === 'total'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <svg v-else-if="card.key === 'active'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.key === 'rating'" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.2 22 12 18.56 5.8 22l1.2-7.86-5-4.87 7.1-1.01L12 2z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </span>
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ card.label }}
          </p>
        </div>
        <p class="text-2xl font-bold leading-none" :class="kpiValueClass[card.tone]">{{ card.value }}</p>
        <p class="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{{ card.meta }}</p>
      </div>
    </div>

    <!-- Filters -->
    <form class="card mb-3 p-3" @submit.prevent>
      <div class="grid grid-cols-2 items-end gap-2 lg:grid-cols-12">
        <div class="relative col-span-2 lg:col-span-5">
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
            placeholder="Search name, specialty, or bio…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.specialty" :class="fieldClass" aria-label="Specialty">
            <option value="">All specialties</option>
            <option v-for="specialty in specialtyOptions" :key="specialty" :value="specialty">{{ specialty }}</option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.status" :class="fieldClass" aria-label="Status">
            <option value="">All statuses</option>
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="col-span-2 flex justify-end lg:col-span-1">
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
        </div>
      </div>

      <div
        v-if="hasFilters"
        class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800"
      >
        <span class="text-[11px] text-neutral-500">
          {{ filteredDoctors.length }} result{{ filteredDoctors.length === 1 ? '' : 's' }}
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

    <!-- Doctors table -->
    <div class="card overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Doctor directory</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[1040px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Doctor</th>
              <th class="px-4 py-2.5 text-left">Specialty</th>
              <th class="px-4 py-2.5 text-left">Rating</th>
              <th class="px-4 py-2.5 text-right">Experience</th>
              <th class="px-4 py-2.5 text-right">Patients</th>
              <th class="px-4 py-2.5 text-right">Session fee</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="row in filteredDoctors"
              :key="row.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-3">
                  <img
                    v-if="row.resolvedPhotoUrl"
                    :src="row.resolvedPhotoUrl"
                    :alt="row.name"
                    class="h-11 w-11 shrink-0 rounded-lg border border-neutral-200 object-cover dark:border-neutral-700"
                  />
                  <div
                    v-else
                    class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    {{ doctorInitials(row.name) }}
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.name }}</p>
                    <p class="text-xs text-neutral-400">Sort #{{ row.sortOrder }}</p>
                    <p v-if="row.bio" class="mt-0.5 line-clamp-1 text-xs text-neutral-500">{{ row.bio }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-2.5">
                <span class="font-medium text-blue-700 dark:text-blue-300">{{ row.specialty }}</span>
              </td>
              <td class="px-4 py-2.5">
                <span class="badge b-amber">{{ row.rating.toFixed(1) }} ★</span>
                <div v-if="row.reviewCount" class="mt-0.5 text-xs text-neutral-500">{{ row.reviewCount }} reviews</div>
              </td>
              <td class="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                {{ row.yearsExperience ?? '—' }}<span v-if="row.yearsExperience" class="text-xs text-neutral-400"> yrs</span>
              </td>
              <td class="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                {{ row.patientsCount?.toLocaleString() ?? '—' }}
              </td>
              <td class="px-4 py-2.5 text-right font-medium text-neutral-800 dark:text-neutral-200">
                <template v-if="row.sessionFee !== null">ZMW {{ row.sessionFee.toFixed(2) }}</template>
                <template v-else>—</template>
              </td>
              <td class="px-4 py-2.5">
                <span :class="row.isActive ? 'badge b-green' : 'badge b-gray'">
                  {{ row.isActive ? 'Active' : 'Hidden' }}
                </span>
              </td>
              <td class="encounters-table__actions px-4 py-2.5">
                <div class="table-action-group">
                  <TableIconButton variant="edit" title="Edit doctor" @click="openEdit(row)" />
                  <TableIconButton variant="delete" tone="danger" title="Delete doctor" @click="destroy(row)" />
                </div>
              </td>
            </tr>
            <tr v-if="!filteredDoctors.length">
              <td colspan="8" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No doctors match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>No featured doctors yet.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="theme-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Doctor' : 'New Doctor' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Name</label>
              <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Specialty</label>
              <input v-model="form.specialty" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.specialty" class="mt-1 text-sm text-red-600">{{ form.errors.specialty }}</p>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Rating</label>
              <input v-model.number="form.rating" type="number" step="0.1" min="0" max="5" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Patients</label>
              <input v-model.number="form.patients_count" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Years</label>
              <input v-model.number="form.years_experience" type="number" min="0" max="80" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Reviews</label>
              <input v-model.number="form.review_count" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Session Fee</label>
              <input v-model.number="form.session_fee" type="number" step="0.01" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Photo URL</label>
            <input v-model="form.photo_url" type="url" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.photo_url" class="mt-1 text-sm text-red-600">{{ form.errors.photo_url }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Bio</label>
            <textarea v-model="form.bio" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.is_active" type="checkbox" /> Active
          </label>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
