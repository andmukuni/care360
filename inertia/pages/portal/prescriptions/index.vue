<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  prescriptions: { data: Array<Record<string, any>>; meta: Record<string, any> }
}>()

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

function itemsSummary(rx: Record<string, any>): string {
  const items: any[] = rx.pharmacyPrescriptionItems ?? []
  const names = items.map((i) => i.drugName).filter(Boolean).slice(0, 3)
  if (!names.length) return 'No items recorded'
  const extra = items.length > 3 ? ` +${items.length - 3} more` : ''
  return names.join(', ') + extra
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Prescriptions</h1>

    <div class="space-y-4">
      <Link v-for="rx in prescriptions.data" :key="rx.id" :href="`/portal/prescriptions/${rx.id}`"
            class="block rounded-xl theme-surface p-4 hover:border-neutral-300 transition">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ rx.prescriptionNumber ?? 'Prescription' }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">
              {{ fmtDateTime(rx.prescribedAt) }}
              <template v-if="rx.encounter"> · {{ rx.encounter.encounterNumber }}</template>
            </p>
            <p class="text-xs text-neutral-500 mt-1 truncate">{{ itemsSummary(rx) }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] text-neutral-400">{{ (rx.pharmacyPrescriptionItems ?? []).length }} item(s)</span>
            <span v-if="rx.status" class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{{ humanize(rx.status) }}</span>
            <span v-if="(rx.pharmacyDispenses ?? []).length" class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Dispensed</span>
          </div>
        </div>
      </Link>
      <div v-if="!prescriptions.data.length" class="theme-surface rounded-xl p-8 text-center">
        <p class="text-sm text-neutral-500">No prescriptions recorded yet</p>
      </div>
    </div>

    <div v-if="prescriptions.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <Link v-if="prescriptions.meta.currentPage > 1" :href="`/portal/prescriptions?page=${prescriptions.meta.currentPage - 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
      <span v-else></span>
      <span class="text-neutral-500">Page {{ prescriptions.meta.currentPage }} of {{ prescriptions.meta.lastPage }}</span>
      <Link v-if="prescriptions.meta.currentPage < prescriptions.meta.lastPage" :href="`/portal/prescriptions?page=${prescriptions.meta.currentPage + 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
      <span v-else></span>
    </div>
  </PortalLayout>
</template>
