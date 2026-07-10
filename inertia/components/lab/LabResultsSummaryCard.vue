<script setup lang="ts">
import { computed } from 'vue'
import { interpretationBadge } from '~/support/lab/lab_result_badges'

type LabResultRow = {
  result_value: string | null
  result_text: string | null
  reference_range: string | null
  interpretation: string | null
  remarks: string | null
}

type LabItemRow = {
  id: number
  test_name: string
  test_group: string | null
  specimen_type: string | null
  result: LabResultRow | null
}

const props = defineProps<{
  requestNumber: string
  items: LabItemRow[]
}>()

const recordedItems = computed(() =>
  props.items.filter((item) => {
    const result = item.result
    if (!result) return false
    return !!(
      result.result_value?.trim() ||
      result.result_text?.trim() ||
      result.reference_range?.trim() ||
      result.interpretation?.trim() ||
      result.remarks?.trim()
    )
  })
)

const interpretationCounts = computed(() => {
  const counts = { normal: 0, abnormal: 0, critical: 0, inconclusive: 0 }
  for (const item of recordedItems.value) {
    const key = String(item.result?.interpretation ?? '').toLowerCase()
    if (key in counts) counts[key as keyof typeof counts] += 1
  }
  return counts
})

const cardTheme = computed(() => {
  if (interpretationCounts.value.critical > 0) return 'critical'
  if (interpretationCounts.value.abnormal > 0) return 'abnormal'
  if (interpretationCounts.value.inconclusive > 0) return 'inconclusive'
  return 'normal'
})

function splitPipe(value: string | null | undefined) {
  if (!value) return []
  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
}

function panelParts(result: LabResultRow) {
  const panelSource =
    result.result_text && result.result_text.includes('|')
      ? result.result_text
      : result.result_value && result.result_value.includes('|')
        ? result.result_value
        : null

  if (!panelSource) return null

  const parts = splitPipe(panelSource)
  const panelName =
    result.result_value &&
    !result.result_value.includes('|') &&
    result.result_text?.includes('|')
      ? result.result_value
      : null

  return { parts, panelName }
}

function parsePanelPart(part: string) {
  const colonPos = part.indexOf(':')
  if (colonPos === -1) return { label: null, value: part }
  return {
    label: part.slice(0, colonPos).trim(),
    value: part.slice(colonPos + 1).trim(),
  }
}

function rowClass(interpretation: string | null | undefined) {
  if (interpretation === 'critical') return 'lab-row-critical'
  if (interpretation === 'abnormal') return 'lab-row-abnormal'
  if (interpretation === 'inconclusive') return 'lab-row-inconclusive'
  return 'lab-row-normal'
}

function pillStyle(interpretation: string | null | undefined) {
  const badge = interpretationBadge(interpretation)
  if (!badge) return null
  return { background: badge.bg, color: badge.color }
}
</script>

<template>
  <div v-if="recordedItems.length" class="lab-card-base shadow-sm" :class="`lab-card-${cardTheme}`">
    <div class="lab-results-header" :class="`lab-head-${cardTheme}`">
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <div class="lab-icon flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg shadow-sm">
          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
        </div>
        <div>
          <p class="lab-title text-sm font-bold">Lab Results</p>
          <p class="lab-sub text-[11px] font-mono">{{ requestNumber }}</p>
        </div>
      </div>

      <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
        <span
          v-if="interpretationCounts.normal > 0"
          class="result-pill rp-normal"
        >
          {{ interpretationCounts.normal }} Normal
        </span>
        <span
          v-if="interpretationCounts.abnormal > 0"
          class="result-pill rp-abnormal"
        >
          {{ interpretationCounts.abnormal }} Abnormal
        </span>
        <span
          v-if="interpretationCounts.critical > 0"
          class="result-pill rp-critical"
        >
          {{ interpretationCounts.critical }} Critical
        </span>
        <span
          v-if="interpretationCounts.inconclusive > 0"
          class="result-pill rp-inconclusive"
        >
          {{ interpretationCounts.inconclusive }} Inconclusive
        </span>
        <span class="lab-sub ml-1 text-[10px] font-medium">{{ recordedItems.length }} total</span>
      </div>
    </div>

    <div class="lab-results-body">
      <table class="lab-results-table text-sm">
        <colgroup>
          <col class="lab-col-test" />
          <col class="lab-col-result" />
          <col class="lab-col-range" />
          <col class="lab-col-interp" />
          <col class="lab-col-remarks" />
        </colgroup>
        <thead class="lab-results-thead" :class="`lab-thead-${cardTheme}`">
          <tr>
            <th>Test</th>
            <th>Result</th>
            <th>Reference Range</th>
            <th>Interpretation</th>
            <th>Notes / Remarks</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
          <tr
            v-for="item in recordedItems"
            :key="item.id"
            :class="rowClass(item.result?.interpretation)"
          >
            <td class="px-4 py-3.5 align-top text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              <span class="block break-words">{{ item.test_name }}</span>
              <span v-if="item.test_group" class="mt-0.5 block break-words text-[10px] font-normal text-neutral-400">
                {{ item.test_group }}
              </span>
              <span v-if="item.specimen_type" class="mt-0.5 block break-words text-[10px] font-normal text-neutral-400">
                {{ item.specimen_type }}
              </span>
            </td>
            <td class="px-4 py-3.5 align-top text-xs font-bold text-neutral-900 dark:text-white">
              <template v-if="item.result && panelParts(item.result)">
                <p
                  v-if="panelParts(item.result)!.panelName"
                  class="mb-1.5 break-words text-xs font-bold text-neutral-700 dark:text-neutral-300"
                >
                  {{ panelParts(item.result)!.panelName }}
                </p>
                <div class="lab-panel-chips">
                  <span
                    v-for="part in panelParts(item.result)!.parts"
                    :key="part"
                    class="lab-panel-chip"
                  >
                    <span
                      v-if="parsePanelPart(part).label"
                      class="mb-0.5 block text-[9px] font-semibold uppercase leading-none tracking-wide text-neutral-400"
                    >
                      {{ parsePanelPart(part).label }}
                    </span>
                    <span class="break-words text-[11px] font-bold leading-snug text-neutral-800 dark:text-neutral-200">
                      {{ parsePanelPart(part).value }}
                    </span>
                  </span>
                </div>
              </template>
              <template v-else>
                <span class="break-words">{{ item.result?.result_value || item.result?.result_text || '—' }}</span>
                <span
                  v-if="
                    item.result?.result_text &&
                    item.result.result_text !== item.result.result_value &&
                    !item.result.result_text.includes('|')
                  "
                  class="mt-1 block break-words text-[10px] font-normal text-neutral-500"
                >
                  {{ item.result.result_text }}
                </span>
              </template>
            </td>
            <td class="break-words px-4 py-3.5 align-top text-xs text-neutral-500">
              {{ item.result?.reference_range?.trim() || '—' }}
            </td>
            <td class="px-4 py-3 align-top">
              <span
                v-if="item.result?.interpretation && pillStyle(item.result.interpretation)"
                class="result-pill"
                :style="pillStyle(item.result.interpretation)!"
              >
                {{ interpretationBadge(item.result.interpretation)?.label }}
              </span>
              <span v-else class="text-xs text-neutral-300">—</span>
            </td>
            <td class="break-words px-4 py-3.5 align-top text-xs text-neutral-500">
              {{ item.result?.remarks?.trim() || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.lab-card-base {
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  border: 1px solid;
  border-left-width: 4px;
  width: 100%;
}
.lab-results-body {
  width: 100%;
  overflow: hidden;
}
.lab-results-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.lab-col-test {
  width: 22%;
}
.lab-col-result {
  width: 28%;
}
.lab-col-range {
  width: 16%;
}
.lab-col-interp {
  width: 14%;
}
.lab-col-remarks {
  width: 20%;
}
.lab-panel-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.lab-panel-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 100%;
  border: 1px solid #e5e5e5;
  background: #f5f5f5;
  padding: 2px 6px;
}
:global(.dark) .lab-panel-chip {
  border-color: #525252;
  background: #262626;
}
.lab-card-normal {
  border-color: #bbf7d0;
  border-left-color: #16a34a;
}
.lab-card-abnormal {
  border-color: #fde68a;
  border-left-color: #d97706;
}
.lab-card-critical {
  border-color: #fecaca;
  border-left-color: #dc2626;
}
.lab-card-inconclusive {
  border-color: #d4d4d4;
  border-left-color: #737373;
}
.lab-results-header {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.lab-head-normal {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-bottom: 1px solid #bbf7d0;
}
.lab-head-abnormal {
  background: linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%);
  border-bottom: 1px solid #fde68a;
}
.lab-head-critical {
  background: linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%);
  border-bottom: 1px solid #fecaca;
}
.lab-head-inconclusive {
  background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
  border-bottom: 1px solid #d4d4d4;
}
.lab-head-normal .lab-title {
  color: #14532d;
}
.lab-head-normal .lab-sub {
  color: #16a34a;
}
.lab-head-abnormal .lab-title {
  color: #78350f;
}
.lab-head-abnormal .lab-sub {
  color: #d97706;
}
.lab-head-critical .lab-title {
  color: #7f1d1d;
}
.lab-head-critical .lab-sub {
  color: #dc2626;
}
.lab-head-inconclusive .lab-title {
  color: #404040;
}
.lab-head-inconclusive .lab-sub {
  color: #737373;
}
.lab-head-normal .lab-icon {
  background: #16a34a;
}
.lab-head-abnormal .lab-icon {
  background: #d97706;
}
.lab-head-critical .lab-icon {
  background: #dc2626;
}
.lab-head-inconclusive .lab-icon {
  background: #737373;
}
.lab-results-thead th {
  padding: 10px 16px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  vertical-align: bottom;
  word-wrap: break-word;
}
.lab-results-table td {
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.lab-thead-normal {
  background: #f0fdf4;
}
.lab-thead-normal th {
  color: #14532d;
  border-bottom: 1px solid #bbf7d0;
}
.lab-thead-abnormal {
  background: #fffbeb;
}
.lab-thead-abnormal th {
  color: #78350f;
  border-bottom: 1px solid #fde68a;
}
.lab-thead-critical {
  background: #fff1f2;
}
.lab-thead-critical th {
  color: #7f1d1d;
  border-bottom: 1px solid #fecaca;
}
.lab-thead-inconclusive {
  background: #fafafa;
}
.lab-thead-inconclusive th {
  color: #404040;
  border-bottom: 1px solid #d4d4d4;
}
.lab-row-critical {
  background: #fff1f2 !important;
  border-left: 3px solid #ef4444;
}
.lab-row-abnormal {
  background: #fffbeb !important;
  border-left: 3px solid #f59e0b;
}
.lab-row-inconclusive {
  background: #fafafa !important;
  border-left: 3px solid #a3a3a3;
}
.lab-row-normal {
  background: #fff;
}
:global(.dark) .lab-row-normal {
  background: transparent;
}
.result-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.rp-normal {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.rp-abnormal {
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fde68a;
}
.rp-critical {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.rp-inconclusive {
  background: #f5f5f5;
  color: #525252;
  border: 1px solid #d4d4d4;
}
</style>
