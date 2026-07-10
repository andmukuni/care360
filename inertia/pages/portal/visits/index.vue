<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  encounters: { data: Array<Record<string, any>>; meta: Record<string, any> }
}>()

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function humanizeStage(stage: any): string {
  const s = String(stage ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'
}

/** Best-effort diagnosis label from the encounter's screening records. */
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
      const label = e.path
        ? String(e.path)
        : [e.level1, e.level2, e.level3].filter(Boolean).join(' › ')
      return label || String(e.type ?? '')
    })
    .filter(Boolean)
    .join(' · ')
}

function encounterDiagnosis(enc: Record<string, any>): string {
  const records: any[] = enc.screeningRecords ?? []
  const review = records.find((r) => r.screeningType === 'review_after_lab')
  const initial = records.find((r) => r.screeningType === 'initial') ?? records[0]
  for (const rec of [review, initial]) {
    if (!rec) continue
    const dx = decodeDiagnosis(rec.finalDiagnosis) || decodeDiagnosis(rec.provisionalDiagnosis)
    if (dx) return dx
  }
  return ''
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Visit history</h1>

    <div class="rounded-xl theme-surface overflow-hidden">
      <Link v-for="enc in encounters.data" :key="enc.id" :href="`/portal/visits/${enc.id}`"
            class="block px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ enc.encounterNumber }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">
              {{ fmtDateTime(enc.startedAt) }} · {{ enc.visitType || 'Visit' }}
            </p>
            <p v-if="encounterDiagnosis(enc)" class="text-xs text-neutral-600 mt-1">
              {{ encounterDiagnosis(enc).slice(0, 80) }}
            </p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 shrink-0">
            {{ humanizeStage(enc.currentStage) }}
          </span>
        </div>
      </Link>
      <p v-if="!encounters.data.length" class="px-4 py-8 text-sm text-neutral-500 text-center">
        No visits recorded yet.
      </p>
    </div>

    <div v-if="encounters.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <Link v-if="encounters.meta.currentPage > 1" :href="`/portal/visits?page=${encounters.meta.currentPage - 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
      <span v-else></span>
      <span class="text-neutral-500">Page {{ encounters.meta.currentPage }} of {{ encounters.meta.lastPage }}</span>
      <Link v-if="encounters.meta.currentPage < encounters.meta.lastPage"
            :href="`/portal/visits?page=${encounters.meta.currentPage + 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
      <span v-else></span>
    </div>
  </PortalLayout>
</template>
