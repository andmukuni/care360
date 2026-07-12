<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface CatalogueEntry {
  id: string
  key: string
  name: string
  description: string
  category: string
  type: string
  exportable: boolean
  module: boolean
  icon_bg: string
  icon_class: string
}

interface ExportBanner {
  id: number
  report_name: string
  status: string
  progress: number
  total_rows: number
  processed: number
  file_size: string | null
  download_url: string | null
  created_at: string | null
  expires_in: string | null
  error_message: string | null
}

const props = defineProps<{
  reportCatalogue: CatalogueEntry[]
  reportCategories: string[]
  activeReport: CatalogueEntry | null
  initialPendingExports: ExportBanner[]
  initialReadyExports: ExportBanner[]
  initialFailedExports: ExportBanner[]
  exportDispatched: boolean
  startDate: string
  endDate: string
  attendantType: string
  lastGenerated: string | null
  lastGeneratedLabel: string
}>()

const search = ref('')
const filterCategory = ref('')
const filterType = ref('')

const filters = reactive({
  start_date: props.startDate,
  end_date: props.endDate,
  attendant_type: props.attendantType || '',
})

watch(
  () => [props.startDate, props.endDate, props.attendantType],
  () => {
    filters.start_date = props.startDate
    filters.end_date = props.endDate
    filters.attendant_type = props.attendantType || ''
  }
)

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const moduleRoutes: Record<string, string> = {
  shift_management: '/reports/shifts',
  shift_timeline: '/reports/shifts/timeline',
  gyn_obs: '/reports/gyn-obs',
  presumptive_tb: '/reports/presumptive-tb',
}

const typeOptions = ['View', 'Table', 'Module']

const isOpd = computed(() => props.activeReport?.key === 'opd_register')

const filteredReports = computed(() => {
  let list = props.reportCatalogue
  const term = search.value.trim().toLowerCase()

  if (term) {
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term)
    )
  }
  if (filterCategory.value) list = list.filter((r) => r.category === filterCategory.value)
  if (filterType.value) list = list.filter((r) => r.type === filterType.value)

  return list
})

const hasBrowseFilters = computed(
  () => search.value.trim() !== '' || filterCategory.value !== '' || filterType.value !== ''
)

function clearBrowseFilters() {
  search.value = ''
  filterCategory.value = ''
  filterType.value = ''
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'View':
      return 'badge b-blue'
    case 'Table':
      return 'badge b-green'
    case 'Module':
      return 'badge b-amber'
    default:
      return 'badge b-gray'
  }
}

function selectReport(entry: CatalogueEntry) {
  if (entry.module && moduleRoutes[entry.key]) {
    router.visit(moduleRoutes[entry.key])
    return
  }
  router.get(
    '/reports',
    { report_key: entry.key, start_date: filters.start_date, end_date: filters.end_date },
    { preserveScroll: true }
  )
}

function clearSelection() {
  router.get(
    '/reports',
    { start_date: filters.start_date, end_date: filters.end_date },
    { preserveScroll: true }
  )
}

function queryParams() {
  const params: Record<string, string> = {
    report_type: props.activeReport!.key,
    start_date: filters.start_date,
    end_date: filters.end_date,
  }
  if (isOpd.value && filters.attendant_type) {
    params.attendant_type = filters.attendant_type
  }
  return params
}

function toQueryString() {
  return new URLSearchParams(queryParams()).toString()
}

function preview() {
  router.get('/reports/preview', queryParams())
}

function queueExport() {
  router.post('/reports/queue-export', queryParams())
}

// ── Export banner polling ───────────────────────────────────────────────────
const pendingExports = ref<ExportBanner[]>([...props.initialPendingExports])
const readyExports = ref<ExportBanner[]>([...props.initialReadyExports])
const failedExports = ref<ExportBanner[]>([...props.initialFailedExports])

let pollTimer: ReturnType<typeof setInterval> | null = null

async function pollExports() {
  try {
    const resp = await fetch('/reports/exports/status', {
      headers: { Accept: 'application/json' },
    })
    if (!resp.ok) return
    const data = await resp.json()
    const exports: ExportBanner[] = data.exports ?? []
    pendingExports.value = exports.filter((e) => e.status === 'pending' || e.status === 'processing')
    readyExports.value = exports.filter((e) => e.status === 'completed')
    failedExports.value = exports.filter((e) => e.status === 'failed')
  } catch {
    // ignore transient network errors
  }
}

async function dismiss(id: number) {
  await fetch(`/reports/exports/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  await pollExports()
}

const hasExportBanners = computed(
  () => pendingExports.value.length > 0 || readyExports.value.length > 0 || failedExports.value.length > 0
)

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Total reports',
    value: String(props.reportCatalogue.length),
    meta: 'Available in catalogue',
    tone: 'sky',
  },
  {
    key: 'categories',
    label: 'Categories',
    value: String(props.reportCategories.length),
    meta: 'Clinical and operations',
    tone: 'violet',
  },
  {
    key: 'last',
    label: 'Last generated',
    value: props.lastGenerated ?? 'None',
    meta: props.lastGeneratedLabel,
    tone: 'teal',
  },
  {
    key: 'exports',
    label: 'Background exports',
    value: pendingExports.value.length > 0 ? String(pendingExports.value.length) : 'Idle',
    meta:
      pendingExports.value.length > 0
        ? `${pendingExports.value.length} export${pendingExports.value.length === 1 ? '' : 's'} in progress`
        : 'Large CSVs run in the background. Progress updates here every few seconds.',
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

onMounted(() => {
  pollExports()
  pollTimer = setInterval(pollExports, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const generatePanel = ref<HTMLElement | null>(null)

watch(
  () => props.activeReport,
  (report) => {
    if (report) {
      requestAnimationFrame(() => {
        generatePanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  },
  { immediate: true }
)
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Reports &amp; Analytics</h1></template>

    <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
      Browse, filter, and generate clinical and operational reports.
    </p>

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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V7l5-5 5 5v12a2 2 0 01-2 2z" />
            </svg>
            <svg v-else-if="card.key === 'categories'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <svg v-else-if="card.key === 'last'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
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

    <div
      v-if="exportDispatched"
      class="card mb-4 border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
    >
      <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-200">Report queued for background generation</h3>
      <p class="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
        Your report is being generated. A download link will appear below when ready.
      </p>
    </div>

    <!-- Export banners -->
    <div v-if="hasExportBanners" class="mb-4 space-y-2">
      <div
        v-for="e in pendingExports"
        :key="`p-${e.id}`"
        class="card border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
      >
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ e.report_name }}</span>
          <span class="badge b-amber capitalize">{{ e.status }}</span>
        </div>
        <div class="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            class="h-2 rounded-full bg-amber-500 transition-all duration-500"
            :style="{ width: `${e.progress}%` }"
          />
        </div>
        <p class="mt-1.5 text-xs text-neutral-500">
          {{ e.processed.toLocaleString() }} / {{ e.total_rows.toLocaleString() }} rows · {{ e.progress }}% complete
        </p>
      </div>

      <div
        v-for="e in readyExports"
        :key="`r-${e.id}`"
        class="card flex flex-wrap items-center justify-between gap-3 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ e.report_name }}</p>
          <p class="text-xs text-neutral-500">
            Ready · {{ e.file_size }}
            <template v-if="e.created_at"> · Generated {{ e.created_at }}</template>
          </p>
          <p v-if="e.expires_in" class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            File auto-deletes in {{ e.expires_in }} — download now.
          </p>
        </div>
        <div class="flex shrink-0 gap-2">
          <a
            v-if="e.download_url"
            :href="e.download_url"
            class="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            Download CSV
          </a>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="dismiss(e.id)"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div
        v-for="e in failedExports"
        :key="`f-${e.id}`"
        class="card flex flex-wrap items-center justify-between gap-3 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ e.report_name }}</p>
          <p class="mt-0.5 text-xs text-red-700 dark:text-red-300">Generation failed</p>
          <p v-if="e.error_message" class="mt-0.5 text-xs text-neutral-500">{{ e.error_message }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          @click="dismiss(e.id)"
        >
          Dismiss
        </button>
      </div>
    </div>

    <!-- Browse catalogue -->
    <div class="card mb-4 overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Browse reports</h2>
      </div>

      <div class="grid grid-cols-2 items-end gap-2 p-3 lg:grid-cols-12">
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
            v-model="search"
            type="search"
            placeholder="Search reports…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterCategory" :class="fieldClass" aria-label="Category">
            <option value="">All categories</option>
            <option v-for="cat in reportCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterType" :class="fieldClass" aria-label="Type">
            <option value="">All types</option>
            <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>

        <div class="col-span-2 flex justify-end lg:col-span-1">
          <button
            v-if="hasBrowseFilters"
            type="button"
            class="theme-icon-btn btn-icon inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Clear filters"
            aria-label="Clear filters"
            @click="clearBrowseFilters"
          >
            <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="overflow-x-auto border-t border-neutral-200 dark:border-neutral-700">
        <table class="encounters-table w-full min-w-[720px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Report</th>
              <th class="px-4 py-2.5 text-left">Category</th>
              <th class="px-4 py-2.5 text-left">Type</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="entry in filteredReports"
              :key="entry.key"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              :class="activeReport?.key === entry.key ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''"
            >
              <td class="px-4 py-3">
                <div class="flex items-start gap-2.5">
                  <span
                    class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded"
                    :class="entry.icon_bg"
                  >
                    <span class="text-xs font-bold" :class="entry.icon_class">{{ entry.type[0] }}</span>
                  </span>
                  <div class="min-w-0">
                    <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ entry.name }}</p>
                    <p class="mt-0.5 line-clamp-2 text-xs text-neutral-500">{{ entry.description }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-neutral-500">{{ entry.category }}</td>
              <td class="px-4 py-3">
                <span :class="typeBadgeClass(entry.type)">{{ entry.type }}</span>
              </td>
              <td class="encounters-table__actions px-4 py-3 text-right">
                <div class="table-action-group">
                  <TableIconButton
                    :variant="entry.module ? 'open' : 'select'"
                    :title="entry.module ? `Open ${entry.name}` : `Select ${entry.name}`"
                    tone="primary"
                    @click="selectReport(entry)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!filteredReports.length">
              <td colspan="4" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasBrowseFilters">
                  No reports match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearBrowseFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>No reports available.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Generate panel -->
    <div
      v-if="activeReport"
      ref="generatePanel"
      class="card overflow-hidden border-neutral-400 dark:border-neutral-500"
    >
      <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <div>
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ activeReport.name }}</h3>
          <p class="text-xs text-neutral-500">{{ activeReport.category }} · {{ activeReport.type }}</p>
        </div>
        <button
          type="button"
          class="text-xl leading-none text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-300"
          aria-label="Close"
          @click="clearSelection"
        >
          &times;
        </button>
      </div>

      <template v-if="activeReport.exportable">
        <div class="p-4">
          <div class="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p class="text-xs leading-relaxed text-blue-900 dark:text-blue-200">
              <strong class="font-semibold">{{ activeReport.name }}</strong><br />
              {{ activeReport.description }}
            </p>
          </div>

          <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-neutral-500">Start date</label>
              <input v-model="filters.start_date" type="date" :class="fieldClass" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-neutral-500">End date</label>
              <input v-model="filters.end_date" type="date" :class="fieldClass" />
            </div>
            <div v-if="isOpd">
              <label class="mb-1 block text-xs font-medium text-neutral-500">Attendant</label>
              <select v-model="filters.attendant_type" :class="fieldClass">
                <option value="">All</option>
                <option value="first_attendant">First attendant</option>
                <option value="re_attendant">Re-attendant</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              class="flex h-10 items-center justify-center rounded-lg bg-cyan-700 text-sm font-semibold text-white transition hover:bg-cyan-600"
              @click="preview"
            >
              Preview report
            </button>
            <a
              :href="`/reports/download-csv?${toQueryString()}`"
              class="flex h-10 items-center justify-center rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Download CSV
            </a>
            <button
              type="button"
              class="flex h-10 items-center justify-center rounded-lg bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-600"
              @click="queueExport"
            >
              Queue background export
            </button>
          </div>

          <p class="mt-3 text-[11px] text-neutral-500">
            CSV background exports are processed by the server queue. Progress updates automatically on this page.
          </p>
        </div>
      </template>

      <template v-else-if="activeReport.module">
        <div class="p-4">
          <div class="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
            <p class="text-xs leading-relaxed text-violet-900 dark:text-violet-200">{{ activeReport.description }}</p>
          </div>
          <Link
            v-if="moduleRoutes[activeReport.key]"
            :href="moduleRoutes[activeReport.key]"
            class="inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            Open {{ activeReport.name }}
          </Link>
        </div>
      </template>
    </div>
  </StaffLayout>
</template>
