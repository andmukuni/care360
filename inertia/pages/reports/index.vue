<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

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

const filters = reactive({
  start_date: props.startDate,
  end_date: props.endDate,
  attendant_type: props.attendantType || '',
})

const moduleRoutes: Record<string, string> = {
  shift_management: '/reports/shifts',
  shift_timeline: '/reports/shifts/timeline',
  gyn_obs: '/reports/gyn-obs',
  presumptive_tb: '/reports/presumptive-tb',
}

const isOpd = computed(() => props.activeReport?.key === 'opd_register')

function selectReport(entry: CatalogueEntry) {
  if (entry.module && moduleRoutes[entry.key]) {
    router.visit(moduleRoutes[entry.key])
    return
  }
  router.get('/reports', { report_key: entry.key, start_date: filters.start_date, end_date: filters.end_date }, {
    preserveScroll: true,
  })
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

function dismiss(id: number) {
  router.delete(`/reports/exports/${id}`, { preserveScroll: true })
}

const entriesByCategory = computed(() => {
  const map: Record<string, CatalogueEntry[]> = {}
  for (const cat of props.reportCategories) {
    map[cat] = props.reportCatalogue.filter((e) => e.category === cat)
  }
  return map
})
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Reports</h1></template>

    <div class="mb-6 flex items-center justify-between">
      <p class="text-sm text-sand-11">
        Last report generated:
        <span class="font-medium text-sand-12">{{ lastGenerated ?? '—' }}</span>
        <span class="text-sand-11"> · {{ lastGeneratedLabel }}</span>
      </p>
    </div>

    <!-- Export banners -->
    <div v-if="initialPendingExports.length || initialReadyExports.length || initialFailedExports.length" class="mb-6 space-y-2">
      <div
        v-for="e in initialPendingExports"
        :key="`p-${e.id}`"
        class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium">{{ e.report_name }} — generating…</span>
          <span class="text-amber-700">{{ e.progress }}%</span>
        </div>
        <div class="mt-2 h-1.5 w-full rounded bg-amber-200">
          <div class="h-1.5 rounded bg-amber-500" :style="{ width: `${e.progress}%` }" />
        </div>
      </div>

      <div
        v-for="e in initialReadyExports"
        :key="`r-${e.id}`"
        class="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm"
      >
        <span class="font-medium">{{ e.report_name }} ready <span class="text-emerald-700">({{ e.file_size }})</span></span>
        <span class="flex items-center gap-3">
          <a v-if="e.download_url" :href="e.download_url" class="text-emerald-700 underline">Download</a>
          <button type="button" class="text-sand-11 hover:underline" @click="dismiss(e.id)">Dismiss</button>
        </span>
      </div>

      <div
        v-for="e in initialFailedExports"
        :key="`f-${e.id}`"
        class="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm"
      >
        <span class="font-medium text-red-800">{{ e.report_name }} failed — {{ e.error_message }}</span>
        <button type="button" class="text-sand-11 hover:underline" @click="dismiss(e.id)">Dismiss</button>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <!-- Report catalogue -->
      <div class="space-y-6">
        <div v-for="cat in reportCategories" :key="cat">
          <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-sand-11">{{ cat }}</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="entry in entriesByCategory[cat]"
              :key="entry.key"
              type="button"
              class="theme-panel rounded-lg p-4 text-left transition hover:border-blue-400 hover:shadow-sm"
              :class="activeReport?.key === entry.key ? 'ring-2 ring-blue-500' : ''"
              @click="selectReport(entry)"
            >
              <div class="flex items-center gap-2">
                <span class="inline-flex h-8 w-8 items-center justify-center rounded" :class="entry.icon_bg">
                  <span class="text-xs font-bold" :class="entry.icon_class">{{ entry.type[0] }}</span>
                </span>
                <span class="font-medium">{{ entry.name }}</span>
                <span v-if="entry.module" class="ml-auto rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">Module</span>
              </div>
              <p class="mt-2 text-xs text-sand-11">{{ entry.description }}</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Filters / actions -->
      <aside class="h-fit theme-panel rounded-lg p-4">
        <h2 class="mb-3 text-sm font-semibold">
          {{ activeReport ? activeReport.name : 'Select a report' }}
        </h2>

        <template v-if="activeReport && !activeReport.module">
          <label class="mb-2 block text-xs font-medium text-sand-11">Start date</label>
          <input v-model="filters.start_date" type="date" class="theme-field mb-3 w-full rounded px-3 py-1.5 text-sm" />

          <label class="mb-2 block text-xs font-medium text-sand-11">End date</label>
          <input v-model="filters.end_date" type="date" class="theme-field mb-3 w-full rounded px-3 py-1.5 text-sm" />

          <template v-if="isOpd">
            <label class="mb-2 block text-xs font-medium text-sand-11">Attendant type</label>
            <select v-model="filters.attendant_type" class="theme-field mb-3 w-full rounded px-3 py-1.5 text-sm">
              <option value="">All</option>
              <option value="first_attendant">First attendant</option>
              <option value="re_attendant">Re-attendant</option>
            </select>
          </template>

          <div class="mt-2 space-y-2">
            <button type="button" class="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white" @click="preview">
              Preview
            </button>
            <a
              :href="`/reports/download-csv?${toQueryString()}`"
              class="theme-icon-btn block w-full rounded px-3 py-2 text-center text-sm hover:bg-sand-2"
            >
              Download CSV
            </a>
            <button
              type="button"
              class="theme-icon-btn w-full rounded px-3 py-2 text-sm hover:bg-sand-2"
              @click="queueExport"
            >
              Queue background export
            </button>
          </div>
        </template>

        <template v-else-if="activeReport && activeReport.module">
          <p class="text-sm text-sand-11">This is an interactive module.</p>
          <Link
            :href="moduleRoutes[activeReport.key] ?? '/reports'"
            class="mt-3 block w-full rounded bg-blue-600 px-3 py-2 text-center text-sm text-white"
          >
            Open {{ activeReport.name }}
          </Link>
        </template>

        <p v-else class="text-sm text-sand-11">Pick a report from the catalogue to set filters and preview data.</p>
      </aside>
    </div>
  </StaffLayout>
</template>
