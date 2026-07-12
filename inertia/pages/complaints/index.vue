<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'

interface Complaint {
  id: number
  title: string
  description: string
  pageUrl: string | null
  severity: string
  status: string
  createdAt: string | null
  createdAtFormatted: string | null
  resolvedAt: string | null
  resolvedAtFormatted: string | null
}

const props = defineProps<{ complaints: Complaint[] }>()

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filterForm = reactive({
  search: '',
  severity: '',
  status: '',
})

const severityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
]

const hasFilters = computed(() =>
  Object.values(filterForm).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  if (filterForm.severity) {
    chips.push({
      key: 'severity',
      label: `Severity: ${severityOptions.find((o) => o.value === filterForm.severity)?.label ?? filterForm.severity}`,
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
  filterForm.severity = ''
  filterForm.status = ''
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = ''
}

const filteredComplaints = computed(() => {
  let list = props.complaints
  const term = filterForm.search.trim().toLowerCase()

  if (term) {
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        (c.pageUrl?.toLowerCase().includes(term) ?? false)
    )
  }
  if (filterForm.severity) list = list.filter((c) => c.severity === filterForm.severity)
  if (filterForm.status) list = list.filter((c) => c.status === filterForm.status)

  return list
})

const openCount = computed(() => props.complaints.filter((c) => c.status === 'open').length)
const resolvedCount = computed(() => props.complaints.filter((c) => c.status === 'resolved').length)
const highSeverityCount = computed(() => props.complaints.filter((c) => c.severity === 'high').length)

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Total reports',
    value: String(props.complaints.length),
    meta: 'Issues you have submitted',
    tone: 'sky',
  },
  {
    key: 'open',
    label: 'Open',
    value: String(openCount.value),
    meta: 'Awaiting platform team review',
    tone: 'amber',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    value: String(resolvedCount.value),
    meta: 'Marked as fixed or addressed',
    tone: 'teal',
  },
  {
    key: 'high',
    label: 'High severity',
    value: String(highSeverityCount.value),
    meta: 'Critical or blocking issues',
    tone: 'violet',
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

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'high':
      return 'badge b-red'
    case 'medium':
      return 'badge b-amber'
    case 'low':
      return 'badge b-blue'
    default:
      return 'badge b-gray'
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'open':
      return 'badge b-amber'
    case 'resolved':
      return 'badge b-green'
    default:
      return 'badge b-gray'
  }
}

function severityLabel(severity: string): string {
  return severityOptions.find((o) => o.value === severity)?.label ?? severity
}

function statusLabel(status: string): string {
  return statusOptions.find((o) => o.value === status)?.label ?? status.replace(/_/g, ' ')
}

const showForm = ref(false)
const viewingComplaint = ref<Complaint | null>(null)

function formatPageLabel(url: string | null): string {
  if (!url) return '—'
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname}${path}`
  } catch {
    return url
  }
}

function openComplaint(row: Complaint) {
  viewingComplaint.value = row
}

const form = useForm({
  title: '',
  description: '',
  page_url: '',
  severity: 'medium',
})

function openReportForm() {
  form.clearErrors()
  form.page_url = typeof window !== 'undefined' ? window.location.href : ''
  showForm.value = true
}

function submit() {
  form.post('/complaints', {
    onSuccess: () => {
      showForm.value = false
      form.reset()
      form.severity = 'medium'
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Complaints</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Report bugs and platform issues so the team can investigate and fix them.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        @click="openReportForm"
      >
        Report an issue
      </button>
    </div>

    <div class="card mb-4 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Platform feedback</p>
      <p class="mt-1 text-sm text-blue-900 dark:text-blue-200">
        Include steps to reproduce, what you expected, and the page URL where the issue occurred. High-severity reports are prioritised.
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 8h10M7 12h6m5 10H6a2 2 0 01-2-2V6a2 2 0 012-2h7.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V20a2 2 0 01-2 2z" />
            </svg>
            <svg v-else-if="card.key === 'open'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.key === 'resolved'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
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
            placeholder="Search title, description, or URL…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.severity" :class="fieldClass" aria-label="Severity">
            <option value="">All severities</option>
            <option v-for="option in severityOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
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
          {{ filteredComplaints.length }} result{{ filteredComplaints.length === 1 ? '' : 's' }}
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

    <!-- Complaints table -->
    <div class="card overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Your reports</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[880px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Issue</th>
              <th class="px-4 py-2.5 text-left">Severity</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="px-4 py-2.5 text-left">Submitted</th>
              <th class="px-4 py-2.5 text-left">Page</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="row in filteredComplaints"
              :key="row.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.title }}</p>
                <p class="mt-0.5 line-clamp-2 text-xs text-neutral-500">{{ row.description }}</p>
                <p v-if="row.resolvedAtFormatted" class="mt-1 text-xs text-green-700 dark:text-green-400">
                  Resolved {{ row.resolvedAtFormatted }}
                </p>
              </td>
              <td class="px-4 py-2.5">
                <span :class="severityBadgeClass(row.severity)">{{ severityLabel(row.severity) }}</span>
              </td>
              <td class="px-4 py-2.5">
                <span :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
              </td>
              <td class="px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                {{ row.createdAtFormatted ?? '—' }}
              </td>
              <td class="px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                <span v-if="row.pageUrl" class="line-clamp-1" :title="row.pageUrl">
                  {{ formatPageLabel(row.pageUrl) }}
                </span>
                <span v-else>—</span>
              </td>
              <td class="encounters-table__actions px-4 py-2.5 text-right">
                <div class="table-action-group">
                  <TableIconButton variant="view" title="View report details" @click="openComplaint(row)" />
                  <TableIconLink
                    v-if="row.pageUrl"
                    :href="row.pageUrl"
                    variant="open"
                    title="Open reported page"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!filteredComplaints.length">
              <td colspan="6" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No reports match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>
                  No complaints submitted yet.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="openReportForm">
                    Report an issue
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="viewingComplaint" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="theme-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg p-6">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">{{ viewingComplaint.title }}</h2>
            <p class="mt-1 text-xs text-neutral-500">
              Submitted {{ viewingComplaint.createdAtFormatted ?? '—' }}
              <span v-if="viewingComplaint.resolvedAtFormatted"> · Resolved {{ viewingComplaint.resolvedAtFormatted }}</span>
            </p>
          </div>
          <button type="button" class="theme-icon-btn rounded px-2 py-1 text-sm" @click="viewingComplaint = null">Close</button>
        </div>
        <div class="mb-4 flex flex-wrap gap-2">
          <span :class="severityBadgeClass(viewingComplaint.severity)">{{ severityLabel(viewingComplaint.severity) }}</span>
          <span :class="statusBadgeClass(viewingComplaint.status)">{{ statusLabel(viewingComplaint.status) }}</span>
        </div>
        <p class="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{{ viewingComplaint.description }}</p>
        <div v-if="viewingComplaint.pageUrl" class="mt-4">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Reported page</p>
          <div class="table-action-group">
            <TableIconLink :href="viewingComplaint.pageUrl" variant="open" title="Open reported page" />
            <span class="text-xs text-neutral-500">{{ viewingComplaint.pageUrl }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="theme-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Report an issue</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div>
            <label class="mb-1 block text-sm font-medium">Title</label>
            <input v-model="form.title" type="text" placeholder="Short summary of the issue" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.title" class="mt-1 text-sm text-red-600">{{ form.errors.title }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Severity</label>
              <select v-model="form.severity" class="theme-field w-full rounded px-3 py-2">
                <option v-for="option in severityOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Page URL (optional)</label>
              <input v-model="form.page_url" type="url" placeholder="https://…" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.page_url" class="mt-1 text-sm text-red-600">{{ form.errors.page_url }}</p>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Description</label>
            <textarea
              v-model="form.description"
              rows="5"
              placeholder="Describe what happened, expected behavior, and steps to reproduce."
              class="theme-field w-full rounded px-3 py-2"
            ></textarea>
            <p v-if="form.errors.description" class="mt-1 text-sm text-red-600">{{ form.errors.description }}</p>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Submitting…">Submit</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
