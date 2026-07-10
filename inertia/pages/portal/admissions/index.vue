<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  admissions: { data: Array<Record<string, any>>; meta: Record<string, any> }
  dischargeSummaries: Array<Record<string, any>>
}>()

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isOpen(admission: Record<string, any>): boolean {
  return !admission.dischargedAt
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Admissions</h1>

    <div class="theme-surface rounded-xl overflow-hidden mb-6">
      <div class="px-4 py-3 border-b border-neutral-100">
        <h2 class="text-sm font-bold text-neutral-900">Bed assignments</h2>
      </div>
      <div class="divide-y divide-neutral-100">
        <div v-for="admission in admissions.data" :key="admission.id" class="px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">
                {{ admission.bed?.ward?.name ?? 'Ward' }}
                <template v-if="admission.bed"> · Bed {{ admission.bed.bedNumber ?? '—' }}</template>
              </p>
              <p class="text-xs text-neutral-500 mt-0.5">
                Admitted {{ fmtDateTime(admission.admittedAt) }}
                <template v-if="admission.dischargedAt"> · Discharged {{ fmtDateTime(admission.dischargedAt) }}</template>
                <template v-if="admission.encounter"> · {{ admission.encounter.encounterNumber }}</template>
              </p>
              <p v-if="admission.notes" class="text-xs text-neutral-500 mt-1">{{ admission.notes }}</p>
            </div>
            <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0"
                  :class="isOpen(admission) ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'">
              {{ isOpen(admission) ? 'Admitted' : 'Discharged' }}
            </span>
          </div>
        </div>
        <div v-if="!admissions.data.length" class="px-4 py-10 text-center">
          <p class="text-sm font-semibold text-neutral-700">No admissions</p>
          <p class="text-xs text-neutral-500 mt-1">Inpatient stays linked to your record will appear here.</p>
        </div>
      </div>
      <div v-if="admissions.meta.lastPage > 1" class="px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-sm">
        <Link v-if="admissions.meta.currentPage > 1" :href="`/portal/admissions?page=${admissions.meta.currentPage - 1}`"
              class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
        <span v-else></span>
        <span class="text-neutral-500">Page {{ admissions.meta.currentPage }} of {{ admissions.meta.lastPage }}</span>
        <Link v-if="admissions.meta.currentPage < admissions.meta.lastPage" :href="`/portal/admissions?page=${admissions.meta.currentPage + 1}`"
              class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
        <span v-else></span>
      </div>
    </div>

    <div class="theme-surface rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100">
        <h2 class="text-sm font-bold text-neutral-900">Discharge summaries</h2>
      </div>
      <div class="divide-y divide-neutral-100">
        <div v-for="summary in dischargeSummaries" :key="summary.id" class="px-4 py-3">
          <p class="text-sm font-semibold">{{ summary.title || 'Discharge summary' }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">
            {{ fmtDate(summary.dischargedAt) }}
            <template v-if="summary.encounter"> · {{ summary.encounter.encounterNumber }}</template>
          </p>
          <p v-if="summary.summary" class="text-sm text-neutral-700 mt-2 whitespace-pre-line">{{ summary.summary }}</p>
        </div>
        <div v-if="!dischargeSummaries.length" class="px-4 py-10 text-center">
          <p class="text-sm font-semibold text-neutral-700">No discharge summaries</p>
          <p class="text-xs text-neutral-500 mt-1">Summaries released to you after discharge will appear here.</p>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
