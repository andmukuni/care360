<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  request: Record<string, any>
}>()

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function humanize(value: any): string {
  const s = String(value ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'
}

const resultsByItem = computed<Record<number, any>>(() => {
  const map: Record<number, any> = {}
  for (const res of props.request.labResults ?? []) {
    if (res.labRequestItemId != null) map[res.labRequestItemId] = res
  }
  return map
})

function resultChips(result: Record<string, any>): string[] {
  if (!result.resultText || result.resultText === result.resultValue) return []
  return result.resultText.split('|').map((p: string) => p.trim()).filter(Boolean)
}
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <Link href="/portal/lab-requests" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">← All lab requests</Link>
      <div class="flex items-center gap-2 flex-wrap mt-2">
        <h1 class="text-2xl font-bold text-neutral-900">{{ request.requestNumber ?? 'Lab request' }}</h1>
        <span v-if="request.status" class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
          {{ humanize(request.status) }}
        </span>
      </div>
      <p class="text-xs text-neutral-500 mt-1.5">
        Requested {{ fmtDateTime(request.requestedAt) }}
        <template v-if="request.encounter"> · {{ request.encounter.encounterNumber }}</template>
      </p>
    </div>

    <div class="theme-surface rounded-xl p-5 mb-4">
      <h2 class="text-sm font-bold text-neutral-900 mb-3">Request details</h2>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div><dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Priority</dt><dd class="font-medium mt-0.5">{{ humanize(request.priorityLevel || 'Normal') }}</dd></div>
        <div><dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Status</dt><dd class="font-medium mt-0.5">{{ humanize(request.status) }}</dd></div>
        <div><dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Requested on</dt><dd class="font-medium mt-0.5">{{ fmtDateTime(request.requestedAt) }}</dd></div>
        <div><dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Completed on</dt><dd class="font-medium mt-0.5">{{ fmtDateTime(request.completedAt) }}</dd></div>
        <div v-if="request.requestNotes" class="sm:col-span-2">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Notes</dt>
          <dd class="font-medium mt-0.5 whitespace-pre-line">{{ request.requestNotes }}</dd>
        </div>
      </dl>
    </div>

    <div class="theme-surface rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100">
        <h2 class="text-sm font-bold text-neutral-900">Tests &amp; results</h2>
      </div>
      <div class="divide-y divide-neutral-100">
        <div v-for="item in request.labRequestItems ?? []" :key="item.id" class="px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm font-semibold text-neutral-900">{{ item.testName ?? 'Test' }}</p>
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                  :class="resultsByItem[item.id] ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'">
              {{ resultsByItem[item.id] ? 'Result ready' : 'Pending' }}
            </span>
          </div>
          <p v-if="item.testGroup || item.specimenType" class="text-xs text-neutral-400 mt-0.5">
            {{ [item.testGroup, item.specimenType].filter(Boolean).join(' · ') }}
          </p>
          <template v-if="resultsByItem[item.id]">
            <div class="mt-2">
              <p class="text-sm text-neutral-700">
                <span class="font-medium">{{ resultsByItem[item.id].resultValue || (resultsByItem[item.id].resultText ? '' : '—') }}</span>
                <span v-if="resultsByItem[item.id].referenceRange" class="text-neutral-400">(Ref: {{ resultsByItem[item.id].referenceRange }})</span>
                <span v-if="resultsByItem[item.id].interpretation" class="text-xs ml-1">· {{ humanize(resultsByItem[item.id].interpretation) }}</span>
              </p>
              <div v-if="resultChips(resultsByItem[item.id]).length" class="flex flex-wrap gap-1 mt-1.5">
                <span v-for="(part, i) in resultChips(resultsByItem[item.id])" :key="i"
                      class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-neutral-700 bg-neutral-100 border border-neutral-200">{{ part }}</span>
              </div>
              <p v-if="resultsByItem[item.id].remarks" class="text-xs text-neutral-500 mt-1">{{ resultsByItem[item.id].remarks }}</p>
              <p class="text-[11px] text-neutral-400 mt-1">Released {{ fmtDate(resultsByItem[item.id].releasedToPatientAt) }}</p>
            </div>
          </template>
          <p v-else class="text-xs text-neutral-400 mt-1">Result not yet released.</p>
        </div>
        <p v-if="!(request.labRequestItems ?? []).length" class="px-4 py-8 text-sm text-neutral-500 text-center">
          No tests on this request
        </p>
      </div>
    </div>
  </PortalLayout>
</template>
