<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface Service {
  id: number
  name: string
  slug: string
  category: string
  categoryLabel: string
  phoneNumber: string
  secondaryPhone: string | null
  description: string | null
  instructions: string | null
  is247: boolean
  isActive: boolean
  sortOrder: number
  contacts24hCount: number
}

interface Contact {
  id: number
  patientName: string
  patientNumber: string | null
  serviceName: string
  source: string
  phoneDialed: string | null
  contactedAt: string | null
  contactedAtFormatted: string | null
}

const props = defineProps<{
  categories: Record<string, string>
  services: Service[]
  recentContacts: Contact[]
}>()

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filterForm = reactive({
  search: '',
  category: '',
  status: '',
})

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Hidden' },
]

const hasFilters = computed(() =>
  Object.values(filterForm).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  if (filterForm.category) {
    chips.push({
      key: 'category',
      label: `Category: ${props.categories[filterForm.category] ?? filterForm.category}`,
    })
  }
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
  filterForm.category = ''
  filterForm.status = ''
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = ''
}

const filteredServices = computed(() => {
  let list = props.services
  const term = filterForm.search.trim().toLowerCase()

  if (term) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.phoneNumber.toLowerCase().includes(term) ||
        (s.secondaryPhone?.toLowerCase().includes(term) ?? false) ||
        s.categoryLabel.toLowerCase().includes(term) ||
        (s.description?.toLowerCase().includes(term) ?? false)
    )
  }
  if (filterForm.category) list = list.filter((s) => s.category === filterForm.category)
  if (filterForm.status === 'active') list = list.filter((s) => s.isActive)
  if (filterForm.status === 'inactive') list = list.filter((s) => !s.isActive)

  return list
})

const totalCalls24h = computed(() => props.services.reduce((sum, s) => sum + s.contacts24hCount, 0))

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Total services',
    value: String(props.services.length),
    meta: 'Listed on portal and app',
    tone: 'sky',
  },
  {
    key: 'active',
    label: 'Active',
    value: String(props.services.filter((s) => s.isActive).length),
    meta: 'Visible to patients',
    tone: 'teal',
  },
  {
    key: '247',
    label: '24/7 lines',
    value: String(props.services.filter((s) => s.is247).length),
    meta: 'Always-on emergency contacts',
    tone: 'violet',
  },
  {
    key: 'calls',
    label: 'Patient calls (24h)',
    value: String(totalCalls24h.value),
    meta: 'Logged from portal and mobile app',
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
  category: 'ambulance',
  phone_number: '',
  secondary_phone: '',
  description: '',
  instructions: '',
  is_24_7: false,
  is_active: true,
  sort_order: 0,
})

function openCreate() {
  editingId.value = null
  form.reset()
  form.clearErrors()
  showForm.value = true
}

function openEdit(s: Service) {
  editingId.value = s.id
  form.clearErrors()
  form.name = s.name
  form.category = s.category
  form.phone_number = s.phoneNumber
  form.secondary_phone = s.secondaryPhone ?? ''
  form.description = s.description ?? ''
  form.instructions = s.instructions ?? ''
  form.is_24_7 = s.is247
  form.is_active = s.isActive
  form.sort_order = s.sortOrder
  showForm.value = true
}

function submit() {
  if (editingId.value) {
    form.put(`/emergency-services/${editingId.value}`, { onSuccess: () => (showForm.value = false) })
  } else {
    form.post('/emergency-services', { onSuccess: () => (showForm.value = false) })
  }
}

function destroy(s: Service) {
  if (confirm(`Remove ${s.name}?`)) {
    router.delete(`/emergency-services/${s.id}`, { preserveScroll: true })
  }
}

function formatSource(source: string): string {
  return source.replace(/_/g, ' ')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Emergency Services</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Manage ambulance and emergency contact numbers shown to patients on the portal and mobile app.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        @click="openCreate"
      >
        New Service
      </button>
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <svg v-else-if="card.key === 'active'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.key === '247'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
            placeholder="Search name, phone, or category…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.category" :class="fieldClass" aria-label="Category">
            <option value="">All categories</option>
            <option v-for="(label, key) in categories" :key="key" :value="key">{{ label }}</option>
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
          {{ filteredServices.length }} result{{ filteredServices.length === 1 ? '' : 's' }}
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

    <!-- Services table -->
    <div class="card mb-4 overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Service directory</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[960px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Service</th>
              <th class="px-4 py-2.5 text-left">Category</th>
              <th class="px-4 py-2.5 text-left">Phone</th>
              <th class="px-4 py-2.5 text-center">24/7</th>
              <th class="px-4 py-2.5 text-right">Calls (24h)</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="row in filteredServices"
              :key="row.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.name }}</p>
                <p v-if="row.description" class="mt-0.5 line-clamp-1 text-xs text-neutral-500">{{ row.description }}</p>
              </td>
              <td class="px-4 py-2.5">
                <span class="badge b-gray">{{ row.categoryLabel }}</span>
              </td>
              <td class="px-4 py-2.5">
                <p class="font-semibold text-red-700 dark:text-red-400">{{ row.phoneNumber }}</p>
                <p v-if="row.secondaryPhone" class="text-xs text-neutral-500">Alt: {{ row.secondaryPhone }}</p>
              </td>
              <td class="px-4 py-2.5 text-center">
                <span v-if="row.is247" class="badge b-blue">24/7</span>
                <span v-else class="text-xs text-neutral-400">—</span>
              </td>
              <td class="px-4 py-2.5 text-right font-medium text-neutral-800 dark:text-neutral-200">
                {{ row.contacts24hCount }}
              </td>
              <td class="px-4 py-2.5">
                <span :class="row.isActive ? 'badge b-green' : 'badge b-gray'">
                  {{ row.isActive ? 'Active' : 'Hidden' }}
                </span>
              </td>
              <td class="encounters-table__actions px-4 py-2.5">
                <div class="table-action-group">
                  <TableIconButton variant="edit" title="Edit service" @click="openEdit(row)" />
                  <TableIconButton variant="delete" tone="danger" title="Delete service" @click="destroy(row)" />
                </div>
              </td>
            </tr>
            <tr v-if="!filteredServices.length">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No services match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>No emergency services yet.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent contacts -->
    <div class="card overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Recent patient emergency calls</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[720px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">When</th>
              <th class="px-4 py-2.5 text-left">Patient</th>
              <th class="px-4 py-2.5 text-left">Service</th>
              <th class="px-4 py-2.5 text-left">Source</th>
              <th class="px-4 py-2.5 text-left">Phone dialed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="c in recentContacts"
              :key="c.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                {{ c.contactedAtFormatted ?? '—' }}
              </td>
              <td class="px-4 py-2.5">
                <Link
                  v-if="c.patientNumber"
                  :href="`/patients/${c.patientNumber}`"
                  class="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                >
                  {{ c.patientName }}
                </Link>
                <span v-else class="font-medium text-neutral-900 dark:text-neutral-100">{{ c.patientName }}</span>
                <div v-if="c.patientNumber" class="text-xs text-neutral-400">{{ c.patientNumber }}</div>
              </td>
              <td class="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{{ c.serviceName }}</td>
              <td class="px-4 py-2.5">
                <span class="badge b-gray capitalize">{{ formatSource(c.source) }}</span>
              </td>
              <td class="px-4 py-2.5 font-medium text-red-700 dark:text-red-400">{{ c.phoneDialed ?? '—' }}</td>
            </tr>
            <tr v-if="!recentContacts.length">
              <td colspan="5" class="px-4 py-12 text-center text-sm text-neutral-500">No calls logged yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="theme-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Service' : 'New Service' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Name</label>
              <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Category</label>
              <select v-model="form.category" class="theme-field w-full rounded px-3 py-2">
                <option v-for="(label, key) in categories" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Phone Number</label>
              <input v-model="form.phone_number" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.phone_number" class="mt-1 text-sm text-red-600">{{ form.errors.phone_number }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Secondary Phone</label>
              <input v-model="form.secondary_phone" type="text" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Description</label>
            <textarea v-model="form.description" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Instructions</label>
            <textarea v-model="form.instructions" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm"><input v-model="form.is_24_7" type="checkbox" /> 24/7</label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" /> Active</label>
            <div class="flex items-center gap-2 text-sm">
              <span>Sort</span>
              <input v-model.number="form.sort_order" type="number" min="0" max="999" class="w-20 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-600" />
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
