<script setup lang="ts">
import UserBadge from '~/components/staff/UserBadge.vue'

type LabResultRow = {
  id: number
  result_value: string | null
  result_text: string | null
  reference_range: string | null
  interpretation: string | null
  remarks: string | null
  result_status: string
  verified_by: { name: string; role: string | null } | null
  verified_at: string | null
  released_by: { name: string; role: string | null } | null
  released_at: string | null
}

type LabItemRow = {
  id: number
  test_name: string
  specimen_type: string | null
  instructions: string | null
  status: string
  result: LabResultRow | null
}

defineProps<{
  items: LabItemRow[]
  compact?: boolean
}>()

function splitPipe(value: string | null | undefined) {
  if (!value) return []
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

function stageText(value: string | null | undefined) {
  if (!value) return '—'
  const withSpaces = value.replaceAll('_', ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

function labRowClass(interpretation: string | null | undefined) {
  if (interpretation === 'critical') return 'rr-critical'
  if (interpretation === 'abnormal') return 'rr-abnormal'
  return ''
}

function labInterpretationBadgeClass(interpretation: string | null | undefined) {
  if (interpretation === 'critical') return 'b-red'
  if (interpretation === 'abnormal') return 'b-amber'
  if (interpretation === 'normal') return 'b-green'
  return 'b-gray'
}

function hasRecordedResult(result: LabResultRow | null) {
  if (!result) return false
  return !!(
    result.result_value?.trim() ||
    result.result_text?.trim() ||
    result.reference_range?.trim() ||
    result.interpretation?.trim() ||
    result.remarks?.trim()
  )
}
</script>

<template>
  <div v-if="items.length">
    <p class="text-[10px] font-bold text-neutral-500 uppercase mb-2">
      Tests & Results ({{ items.length }})
    </p>
    <table class="enc-table" :class="compact ? 'mb-0' : 'mb-5'">
      <thead>
        <tr>
          <th>Test</th>
          <th>Instructions</th>
          <th>Result</th>
          <th>Reference Range</th>
          <th>Interpretation</th>
          <th v-if="!compact">Status</th>
          <th v-if="!compact">Verified</th>
          <th v-if="!compact">Released</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :class="labRowClass(item.result?.interpretation)"
        >
          <td class="font-medium align-top">
            <div>{{ item.test_name }}</div>
            <div v-if="item.specimen_type" class="text-[11px] font-normal text-neutral-500 mt-0.5">
              {{ item.specimen_type }}
            </div>
            <span class="badge b-gray mt-1">{{ stageText(item.status) }}</span>
          </td>
          <td class="text-sm text-neutral-600 align-top max-w-[220px]">
            {{ item.instructions?.trim() || '—' }}
          </td>
          <td class="align-top">
            <template v-if="hasRecordedResult(item.result)">
              <span class="font-bold">{{ item.result?.result_value || '—' }}</span>
              <span
                v-if="item.result?.result_text && item.result.result_text !== item.result.result_value"
                class="flex flex-wrap gap-1 mt-1"
              >
                <span
                  v-for="part in splitPipe(item.result?.result_text)"
                  :key="part"
                  class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-normal text-neutral-700 bg-neutral-100 border border-neutral-200"
                >
                  {{ part }}
                </span>
              </span>
              <span v-if="item.result?.remarks" class="block text-[11px] text-neutral-500 mt-1">
                Remarks: {{ item.result.remarks }}
              </span>
            </template>
            <span v-else class="text-sm text-neutral-400 italic">Pending</span>
          </td>
          <td class="text-neutral-500 align-top">
            {{ item.result?.reference_range?.trim() || '—' }}
          </td>
          <td class="align-top">
            <span
              v-if="item.result?.interpretation"
              class="badge"
              :class="labInterpretationBadgeClass(item.result.interpretation)"
            >
              {{ stageText(item.result.interpretation) }}
            </span>
            <span v-else class="text-neutral-300">—</span>
          </td>
          <td v-if="!compact" class="align-top">
            {{ item.result?.result_status ? stageText(item.result.result_status) : '—' }}
          </td>
          <td v-if="!compact" class="text-xs align-top">
            <template v-if="item.result?.verified_at">
              <UserBadge :user="item.result.verified_by" size="sm" />
              <span class="block text-neutral-400">{{ item.result.verified_at }}</span>
            </template>
            <span v-else class="text-neutral-300">—</span>
          </td>
          <td v-if="!compact" class="text-xs align-top">
            <template v-if="item.result?.released_at">
              <UserBadge :user="item.result.released_by" size="sm" />
              <span class="block text-neutral-400">{{ item.result.released_at }}</span>
            </template>
            <span v-else class="text-neutral-300">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="text-sm text-neutral-400 italic">No tests ordered.</p>
</template>
