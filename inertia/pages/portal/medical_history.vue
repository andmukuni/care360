<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  diagnoses: { data: Array<Record<string, any>>; meta: Record<string, any> }
}>()

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function decodeDiagnosis(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim()
  if (value === '') return ''
  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    const m = value.match(/^\[(.*)\]$/s)
    return m ? m[1].trim() : value
  }
  if (!Array.isArray(decoded)) return value
  return decoded
    .map((e: any) => {
      if (e === null || typeof e !== 'object') return String(e ?? '').trim()
      const label = e.path ? String(e.path) : [e.level1, e.level2, e.level3].filter(Boolean).join(' › ')
      const extras = [e.certainty, e.attendance].filter(Boolean).join(', ')
      return extras ? `${label} (${extras})`.trim() : label || String(e.type ?? '')
    })
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Medical history</h1>

    <div class="rounded-xl theme-surface overflow-hidden">
      <div v-for="record in diagnoses.data" :key="record.id" class="px-4 py-3 border-b border-neutral-100 last:border-0">
        <template v-if="decodeDiagnosis(record.finalDiagnosis)">
          <p class="text-sm font-semibold">{{ decodeDiagnosis(record.finalDiagnosis) }}</p>
          <p v-if="decodeDiagnosis(record.provisionalDiagnosis) && decodeDiagnosis(record.provisionalDiagnosis) !== decodeDiagnosis(record.finalDiagnosis)"
             class="text-xs text-neutral-500 mt-0.5">
            Provisional: {{ decodeDiagnosis(record.provisionalDiagnosis) }}
          </p>
        </template>
        <template v-else>
          <p class="text-sm font-semibold">{{ decodeDiagnosis(record.provisionalDiagnosis) }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">Provisional diagnosis</p>
        </template>
        <p class="text-xs text-neutral-400 mt-1">
          {{ fmtDate(record.createdAt) }}
          <template v-if="record.encounter"> · {{ record.encounter.encounterNumber }}</template>
        </p>
      </div>
      <div v-if="!diagnoses.data.length" class="px-4 py-10 text-center">
        <p class="text-sm font-semibold text-neutral-700">No diagnoses recorded</p>
        <p class="text-xs text-neutral-500 mt-1">Diagnoses shared with you by the hospital will appear here.</p>
      </div>
    </div>

    <div v-if="diagnoses.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <Link v-if="diagnoses.meta.currentPage > 1" :href="`/portal/medical-history?page=${diagnoses.meta.currentPage - 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
      <span v-else></span>
      <span class="text-neutral-500">Page {{ diagnoses.meta.currentPage }} of {{ diagnoses.meta.lastPage }}</span>
      <Link v-if="diagnoses.meta.currentPage < diagnoses.meta.lastPage"
            :href="`/portal/medical-history?page=${diagnoses.meta.currentPage + 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
      <span v-else></span>
    </div>
  </PortalLayout>
</template>
