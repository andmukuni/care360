<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  results: { data: Array<Record<string, any>>; meta: Record<string, any> }
}>()

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Lab results</h1>

    <div class="rounded-xl theme-surface overflow-hidden">
      <div v-for="result in results.data" :key="result.id" class="px-4 py-3 border-b border-neutral-100 last:border-0">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ result.labRequestItem?.testName ?? 'Lab test' }}</p>
            <p class="text-sm text-neutral-700 mt-0.5">
              {{ result.resultValue || result.resultText || '—' }}
              <span v-if="result.referenceRange" class="text-neutral-400 text-xs">(Ref: {{ result.referenceRange }})</span>
            </p>
            <p v-if="result.interpretation" class="text-xs text-neutral-500 mt-1">{{ result.interpretation }}</p>
            <p class="text-xs text-neutral-400 mt-1">
              {{ fmtDateTime(result.resultRecordedAt) }}
              <template v-if="result.encounter"> · {{ result.encounter.encounterNumber }}</template>
            </p>
            <a :href="`/portal/lab-results/${result.id}/download`"
               class="text-xs font-semibold text-neutral-700 underline mt-1 inline-block">Download report</a>
          </div>
          <span v-if="result.resultStatus" class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 shrink-0">
            {{ result.resultStatus }}
          </span>
        </div>
      </div>
      <p v-if="!results.data.length" class="px-4 py-8 text-sm text-neutral-500 text-center">No lab results available yet.</p>
    </div>

    <div v-if="results.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <Link v-if="results.meta.currentPage > 1" :href="`/portal/lab-results?page=${results.meta.currentPage - 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
      <span v-else></span>
      <span class="text-neutral-500">Page {{ results.meta.currentPage }} of {{ results.meta.lastPage }}</span>
      <Link v-if="results.meta.currentPage < results.meta.lastPage" :href="`/portal/lab-results?page=${results.meta.currentPage + 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
      <span v-else></span>
    </div>
  </PortalLayout>
</template>
