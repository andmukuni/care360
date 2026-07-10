<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

interface TablePreview {
  kind: 'table'
  title: string
  period: string
  table: { headers: string[]; rows: (string | number)[][]; truncated: boolean; limit: number }
}
interface HiaPreview {
  kind: 'hia'
  title: string
  period: string
  hia: {
    topDiagnoses: { name: string; code: string; opd_total: number; ipd_total: number; death_total: number }[]
    catalogueRows: number
    unmatchedEvents: number
  }
}
interface GynObsPreview {
  kind: 'gyn_obs'
  title: string
  period: string
  gynObs: any
}

const props = defineProps<{
  reportType: string
  catalogueEntry: { key: string; name: string } | null
  filters: { start_date?: string; end_date?: string; attendant_type?: string | null }
  preview: TablePreview | HiaPreview | GynObsPreview
  hubQuery: string
}>()

function csvQuery() {
  const params: Record<string, string> = { report_type: props.reportType }
  if (props.filters.start_date) params.start_date = props.filters.start_date
  if (props.filters.end_date) params.end_date = props.filters.end_date
  if (props.filters.attendant_type) params.attendant_type = props.filters.attendant_type
  return new URLSearchParams(params).toString()
}

// DataTable expects keyed columns/rows; map the flat header/row arrays.
const tableColumns = computed(() => {
  if (props.preview.kind !== 'table') return []
  return props.preview.table.headers.map((h, i) => ({ key: `c${i}`, label: h }))
})
const tableRows = computed(() => {
  if (props.preview.kind !== 'table') return []
  return props.preview.table.rows.map((row) => {
    const obj: Record<string, string | number> = {}
    row.forEach((v, i) => (obj[`c${i}`] = v))
    return obj
  })
})
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">{{ preview.title }} — Preview</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-sand-11">Period: {{ preview.period }}</p>
      <div class="flex items-center gap-2">
        <Link :href="`/reports?${hubQuery}`" class="theme-icon-btn rounded px-3 py-1.5 text-sm hover:bg-sand-2">
          Back to hub
        </Link>
        <a :href="`/reports/download-csv?${csvQuery()}`" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
          Download CSV
        </a>
      </div>
    </div>

    <!-- Tabular reports -->
    <template v-if="preview.kind === 'table'">
      <p v-if="preview.table.truncated" class="mb-2 text-xs text-amber-700">
        Preview limited to the first {{ preview.table.limit }} rows. Download the CSV for the full dataset.
      </p>
      <DataTable :columns="tableColumns" :rows="tableRows" :per-page="25" empty-text="No rows for this period." />
    </template>

    <!-- HIA aggregate -->
    <template v-else-if="preview.kind === 'hia'">
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="theme-panel rounded-lg p-4">
          <p class="text-xs text-sand-11">Catalogue lines</p>
          <p class="text-2xl font-semibold">{{ preview.hia.catalogueRows }}</p>
        </div>
        <div class="theme-panel rounded-lg p-4">
          <p class="text-xs text-sand-11">Unmatched events</p>
          <p class="text-2xl font-semibold">{{ preview.hia.unmatchedEvents }}</p>
        </div>
      </div>
      <div class="overflow-x-auto theme-panel rounded-lg">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-sand-6 text-left text-sand-11">
              <th class="px-3 py-2 font-medium">Diagnosis</th>
              <th class="px-3 py-2 font-medium">Code</th>
              <th class="px-3 py-2 font-medium text-right">OPD</th>
              <th class="px-3 py-2 font-medium text-right">IPD</th>
              <th class="px-3 py-2 font-medium text-right">Deaths</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in preview.hia.topDiagnoses" :key="d.code" class="border-b border-sand-4">
              <td class="px-3 py-2">{{ d.name }}</td>
              <td class="px-3 py-2">{{ d.code }}</td>
              <td class="px-3 py-2 text-right">{{ d.opd_total }}</td>
              <td class="px-3 py-2 text-right">{{ d.ipd_total }}</td>
              <td class="px-3 py-2 text-right">{{ d.death_total }}</td>
            </tr>
            <tr v-if="!preview.hia.topDiagnoses.length">
              <td colspan="5" class="px-3 py-6 text-center text-sand-11">No matched diagnoses for this period.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Gyn & OBS -->
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="theme-panel rounded-lg p-4">
          <h3 class="mb-2 text-sm font-semibold">Cervical screening</h3>
          <dl class="space-y-1 text-sm">
            <div v-for="(v, k) in preview.gynObs.cervicalSummary" :key="k" class="flex justify-between">
              <dt class="text-sand-11">{{ String(k).replace(/_/g, ' ') }}</dt>
              <dd class="font-medium">{{ v }}</dd>
            </div>
          </dl>
        </div>
        <div class="theme-panel rounded-lg p-4">
          <h3 class="mb-2 text-sm font-semibold">Antenatal</h3>
          <dl class="space-y-1 text-sm">
            <div v-for="(v, k) in preview.gynObs.antenatalSummary" :key="k" class="flex justify-between">
              <dt class="text-sand-11">{{ String(k).replace(/_/g, ' ') }}</dt>
              <dd class="font-medium">{{ v ?? '—' }}</dd>
            </div>
          </dl>
        </div>
      </div>
      <p class="mt-4 text-sm text-sand-11">
        Full breakdown (contraceptive distribution, upcoming deliveries, trends) is available in the
        <Link href="/reports/gyn-obs" class="text-blue-600 underline">Gyn &amp; OBS dashboard</Link>
        and the CSV export.
      </p>
    </template>
  </StaffLayout>
</template>
