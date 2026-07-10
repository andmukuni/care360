<script setup lang="ts">
import { ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  requests: { data: Array<Record<string, any>>; meta: Record<string, any> }
  results: { data: Array<Record<string, any>>; meta: Record<string, any> }
  tab: string
}>()

const activeTab = ref(props.tab === 'results' ? 'results' : 'requests')

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function humanize(value: any): string {
  const s = String(value ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : ''
}

function resultChips(result: Record<string, any>): string[] {
  if (!result.resultText || result.resultText === result.resultValue) return []
  return result.resultText.split('|').map((p: string) => p.trim()).filter(Boolean)
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold text-neutral-900 mb-6">Lab</h1>

    <div class="flex flex-wrap gap-2 mb-4">
      <button type="button" @click="activeTab = 'requests'"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition"
              :class="activeTab === 'requests' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'">
        Requests
        <span v-if="requests.meta.total" class="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full bg-neutral-100 text-neutral-600">{{ requests.meta.total }}</span>
      </button>
      <button type="button" @click="activeTab = 'results'"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition"
              :class="activeTab === 'results' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'">
        Results
        <span v-if="results.meta.total" class="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full bg-neutral-100 text-neutral-600">{{ results.meta.total }}</span>
      </button>
    </div>

    <!-- Requests -->
    <div v-show="activeTab === 'requests'" class="space-y-4">
      <Link v-for="request in requests.data" :key="request.id" :href="`/portal/lab-requests/${request.id}`"
            class="block rounded-xl theme-surface p-4 hover:border-neutral-300 transition">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-sm font-semibold">{{ request.requestNumber ?? 'Lab request' }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">
              {{ fmtDateTime(request.requestedAt) }}
              <template v-if="request.encounter"> · {{ request.encounter.encounterNumber }}</template>
            </p>
          </div>
          <span v-if="request.status" class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 shrink-0">
            {{ humanize(request.status) }}
          </span>
        </div>
        <ul v-if="(request.labRequestItems ?? []).length" class="text-sm space-y-1">
          <li v-for="item in request.labRequestItems" :key="item.id" class="text-neutral-700">
            {{ item.testName ?? 'Test' }}
            <span v-if="item.status" class="text-xs text-neutral-400">· {{ item.status }}</span>
          </li>
        </ul>
        <p v-if="request.requestNotes" class="text-xs text-neutral-500 mt-2">{{ request.requestNotes }}</p>
      </Link>
      <div v-if="!requests.data.length" class="theme-surface rounded-xl p-8 text-center">
        <p class="text-sm font-semibold text-neutral-700">No lab requests</p>
        <p class="text-xs text-neutral-500 mt-1">Lab test orders from your visits will appear here.</p>
      </div>
    </div>

    <!-- Results -->
    <div v-show="activeTab === 'results'" class="rounded-xl theme-surface overflow-hidden">
      <div v-for="result in results.data" :key="result.id" class="px-4 py-3 border-b border-neutral-100 last:border-0">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ result.labRequestItem?.testName ?? 'Lab test' }}</p>
            <p class="text-sm text-neutral-700 mt-0.5">
              {{ result.resultValue || (result.resultText ? '' : '—') }}
              <span v-if="result.referenceRange" class="text-neutral-400 text-xs">(Ref: {{ result.referenceRange }})</span>
              <span v-if="result.interpretation" class="text-xs ml-1">· {{ humanize(result.interpretation) }}</span>
            </p>
            <div v-if="resultChips(result).length" class="flex flex-wrap gap-1 mt-1.5">
              <span v-for="(part, i) in resultChips(result)" :key="i"
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-neutral-700 bg-neutral-100 border border-neutral-200">
                {{ part }}
              </span>
            </div>
            <p class="text-xs text-neutral-400 mt-1">
              {{ fmtDateTime(result.releasedToPatientAt ?? result.resultRecordedAt) }}
              <template v-if="result.encounter"> · {{ result.encounter.encounterNumber }}</template>
            </p>
          </div>
          <span v-if="result.resultStatus" class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 shrink-0">
            {{ result.resultStatus }}
          </span>
        </div>
      </div>
      <p v-if="!results.data.length" class="px-4 py-8 text-sm text-neutral-500 text-center">No lab results available yet.</p>
    </div>
  </PortalLayout>
</template>
