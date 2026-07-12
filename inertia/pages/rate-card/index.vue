<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface RateCardRow {
  id: number
  code: string
  name: string
  category: string
  activityType: string
  activityKey: string | null
  linkedActivity: string
  price: number
  isActive: boolean
}

const props = defineProps<{
  services: {
    data: RateCardRow[]
    meta: {
      currentPage: number
      lastPage: number
      perPage: number
      total: number
    }
  }
  filters: { search: string; activityType: string; category: string; status: string }
  activityTypes: string[]
  categories: string[]
  counts: Record<string, number>
}>()

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const activityLabels: Record<string, string> = {
  consultation: 'Consultations',
  lab_test: 'Lab tests',
  medication: 'Medications',
  treatment_room: 'Treatment room',
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Hidden' },
]

const filterForm = reactive({
  search: '',
  activity_type: '',
  category: '',
  status: '',
})

watch(
  () => props.filters,
  (filters) => {
    filterForm.search = filters.search ?? ''
    filterForm.activity_type = filters.activityType ?? ''
    filterForm.category = filters.category ?? ''
    filterForm.status = filters.status ?? ''
  },
  { immediate: true, deep: true }
)

const totalServices = computed(() => Object.values(props.counts).reduce((sum, n) => sum + n, 0))

const hasFilters = computed(() =>
  Object.values(filterForm).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  if (filterForm.activity_type) {
    chips.push({
      key: 'activity_type',
      label: `Type: ${activityLabels[filterForm.activity_type] ?? filterForm.activity_type}`,
    })
  }
  if (filterForm.category) chips.push({ key: 'category', label: `Category: ${filterForm.category}` })
  if (filterForm.status) {
    chips.push({
      key: 'status',
      label: `Status: ${statusOptions.find((o) => o.value === filterForm.status)?.label ?? filterForm.status}`,
    })
  }

  return chips
})

function filterParams(page = 1) {
  const data: Record<string, string | number> = { page }
  if (filterForm.search.trim()) data.search = filterForm.search.trim()
  if (filterForm.activity_type) data.activity_type = filterForm.activity_type
  if (filterForm.category) data.category = filterForm.category
  if (filterForm.status) data.status = filterForm.status
  return data
}

function applyFilters() {
  router.get('/rate-card', filterParams(1), { preserveState: true, preserveScroll: true })
}

function clearFilters() {
  Object.assign(filterForm, { search: '', activity_type: '', category: '', status: '' })
  router.get('/rate-card', {}, { preserveState: true, preserveScroll: true })
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = ''
  applyFilters()
}

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Total services',
    value: String(totalServices.value),
    meta: 'Linked billing rates',
    tone: 'sky',
  },
  {
    key: 'consultation',
    label: 'Consultations',
    value: String(props.counts.consultation ?? 0),
    meta: 'Visit-type consultation fees',
    tone: 'teal',
  },
  {
    key: 'lab',
    label: 'Lab tests',
    value: String(props.counts.lab_test ?? 0),
    meta: 'Catalog-linked test prices',
    tone: 'violet',
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy & room',
    value: String((props.counts.medication ?? 0) + (props.counts.treatment_room ?? 0)),
    meta: 'Medications and treatment room',
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

const editingId = ref<number | null>(null)

function startEdit(row: RateCardRow) {
  editingId.value = row.id
}

function cancelEdit() {
  editingId.value = null
}

function saveEdit(row: RateCardRow, form: HTMLFormElement) {
  const formData = new FormData(form)
  router.put(
    `/rate-card/${row.id}`,
    {
      name: formData.get('name'),
      price: Number(formData.get('price')),
      category: formData.get('category'),
      is_active: formData.get('is_active') === 'on',
    },
    {
      preserveScroll: true,
      onSuccess: () => {
        editingId.value = null
      },
    }
  )
}

function syncCatalog() {
  if (!confirm('Sync rate card from consultations, lab tests, medications, and treatment room? Existing prices will be kept.')) {
    return
  }
  router.post('/rate-card/sync')
}

function formatPrice(value: number) {
  return `ZMW ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function activityBadgeClass(type: string): string {
  switch (type) {
    case 'consultation':
      return 'badge b-blue'
    case 'lab_test':
      return 'badge b-green'
    case 'medication':
      return 'badge b-amber'
    case 'treatment_room':
      return 'badge b-gray'
    default:
      return 'badge b-gray'
  }
}

function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'hospital':
      return 'badge b-blue'
    case 'pharmacy':
      return 'badge b-green'
    case 'outsourced':
      return 'badge b-amber'
    default:
      return 'badge b-gray'
  }
}

function pageHref(page: number) {
  const params = new URLSearchParams()
  if (filterForm.search.trim()) params.set('search', filterForm.search.trim())
  if (filterForm.activity_type) params.set('activity_type', filterForm.activity_type)
  if (filterForm.category) params.set('category', filterForm.category)
  if (filterForm.status) params.set('status', filterForm.status)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/rate-card?${qs}` : '/rate-card'
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Rate Card</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Configure prices for consultations, lab tests, medications, and treatment room services used in billing previews and invoices.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        @click="syncCatalog"
      >
        Sync from activities
      </button>
    </div>

    <div class="card mb-4 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Billing</p>
      <p class="mt-1 text-sm text-blue-900 dark:text-blue-200">
        Inactive or missing services fall back to system defaults. Sync pulls new items from the clinical catalog without overwriting existing prices.
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 7h6m0 10v-5m-3 5h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <svg v-else-if="card.key === 'consultation'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <svg v-else-if="card.key === 'lab'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 9H9L8 4z" />
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
            placeholder="Search name, code, or activity…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-2">
          <select v-model="filterForm.activity_type" :class="fieldClass" aria-label="Activity type">
            <option value="">All types</option>
            <option v-for="type in activityTypes" :key="type" :value="type">
              {{ activityLabels[type] ?? type }} ({{ counts[type] ?? 0 }})
            </option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-2">
          <select v-model="filterForm.category" :class="fieldClass" aria-label="Category">
            <option value="">All categories</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-2">
          <select v-model="filterForm.status" :class="fieldClass" aria-label="Status">
            <option value="">All statuses</option>
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-2">
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
          {{ services.meta.total }} result{{ services.meta.total === 1 ? '' : 's' }}
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
    <div class="card overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Service rates</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[960px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Service</th>
              <th class="px-4 py-2.5 text-left">Linked activity</th>
              <th class="px-4 py-2.5 text-left">Type</th>
              <th class="px-4 py-2.5 text-left">Category</th>
              <th class="px-4 py-2.5 text-right">Price</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <template v-for="row in services.data" :key="row.id">
              <tr v-if="editingId === row.id" class="bg-blue-50/50 dark:bg-blue-900/10">
                <td colspan="7" class="px-4 py-3">
                  <form class="grid gap-3 md:grid-cols-6" @submit.prevent="saveEdit(row, $event.target as HTMLFormElement)">
                    <label class="md:col-span-2">
                      <span class="mb-1 block text-xs font-medium text-neutral-500">Name</span>
                      <input name="name" :value="row.name" required class="theme-field w-full rounded px-2.5 py-2" />
                    </label>
                    <label>
                      <span class="mb-1 block text-xs font-medium text-neutral-500">Price (ZMW)</span>
                      <input name="price" type="number" min="0" step="0.01" :value="row.price" required class="theme-field w-full rounded px-2.5 py-2" />
                    </label>
                    <label>
                      <span class="mb-1 block text-xs font-medium text-neutral-500">Category</span>
                      <select name="category" :value="row.category" class="theme-field w-full rounded px-2.5 py-2">
                        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                      </select>
                    </label>
                    <label class="flex items-end gap-2 pb-2">
                      <input name="is_active" type="checkbox" :checked="row.isActive" />
                      <span class="text-xs">Active</span>
                    </label>
                    <div class="flex items-end justify-end gap-2">
                      <button type="button" class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-600" @click="cancelEdit">
                        Cancel
                      </button>
                      <button type="submit" class="rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                        Save
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
              <tr
                v-else
                class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <td class="px-4 py-2.5">
                  <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.name }}</p>
                  <p class="font-mono text-xs text-neutral-500">{{ row.code }}</p>
                </td>
                <td class="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{{ row.linkedActivity }}</td>
                <td class="px-4 py-2.5">
                  <span :class="activityBadgeClass(row.activityType)">
                    {{ activityLabels[row.activityType] ?? row.activityType.replace(/_/g, ' ') }}
                  </span>
                </td>
                <td class="px-4 py-2.5">
                  <span :class="categoryBadgeClass(row.category)" class="capitalize">{{ row.category }}</span>
                </td>
                <td class="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ formatPrice(row.price) }}
                </td>
                <td class="px-4 py-2.5">
                  <span :class="row.isActive ? 'badge b-green' : 'badge b-gray'">
                    {{ row.isActive ? 'Active' : 'Hidden' }}
                  </span>
                </td>
                <td class="encounters-table__actions px-4 py-2.5 text-right">
                  <div class="table-action-group">
                    <TableIconButton variant="edit" title="Edit service" @click="startEdit(row)" />
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!services.data.length">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No services match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>
                  No rate card services found.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="syncCatalog">
                    Sync from activities
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="services.meta.lastPage > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-700"
      >
        <span class="text-neutral-500">
          Page {{ services.meta.currentPage }} of {{ services.meta.lastPage }} · {{ services.meta.total }} services
        </span>
        <div class="flex gap-2">
          <Link
            v-if="services.meta.currentPage > 1"
            :href="pageHref(services.meta.currentPage - 1)"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
            preserve-state
            preserve-scroll
          >
            Previous
          </Link>
          <Link
            v-if="services.meta.currentPage < services.meta.lastPage"
            :href="pageHref(services.meta.currentPage + 1)"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
            preserve-state
            preserve-scroll
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
