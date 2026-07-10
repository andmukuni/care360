<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface TbRecord {
  id: number
  case_no: string | null
  screened_at: string | null
  patient: string | null
  encounter: string | null
  constitutional_symptoms: string | null
  clinician: string | null
}

defineProps<{
  records: TbRecord[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
  summary: { total: number; today: number; this_month: number }
}>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Presumptive TB Register</h1></template>

    <div class="mb-4">
      <Link href="/reports" class="text-sm text-blue-600 hover:underline">← Back to reports</Link>
    </div>

    <div class="mb-6 grid grid-cols-3 gap-3">
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Total cases</p>
        <p class="text-2xl font-semibold">{{ summary.total }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Today</p>
        <p class="text-2xl font-semibold">{{ summary.today }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">This month</p>
        <p class="text-2xl font-semibold">{{ summary.this_month }}</p>
      </div>
    </div>

    <div class="overflow-x-auto theme-panel rounded-lg">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-sand-6 text-left text-sand-11">
            <th class="px-3 py-2 font-medium">Case No</th>
            <th class="px-3 py-2 font-medium">Screened At</th>
            <th class="px-3 py-2 font-medium">Patient</th>
            <th class="px-3 py-2 font-medium">Encounter</th>
            <th class="px-3 py-2 font-medium">Constitutional Symptoms</th>
            <th class="px-3 py-2 font-medium">Clinician</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id" class="border-b border-sand-4">
            <td class="px-3 py-2 font-medium">{{ r.case_no }}</td>
            <td class="px-3 py-2">{{ r.screened_at ?? '—' }}</td>
            <td class="px-3 py-2">{{ r.patient ?? '—' }}</td>
            <td class="px-3 py-2">{{ r.encounter ?? '—' }}</td>
            <td class="px-3 py-2">{{ r.constitutional_symptoms ?? '—' }}</td>
            <td class="px-3 py-2">{{ r.clinician ?? '—' }}</td>
          </tr>
          <tr v-if="!records.length">
            <td colspan="6" class="px-3 py-6 text-center text-sand-11">No presumptive TB cases recorded.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="meta.last_page > 1" class="mt-3 flex items-center justify-between text-sm">
      <span class="text-sand-11">{{ meta.total }} cases</span>
      <div class="flex items-center gap-2">
        <Link
          v-if="meta.current_page > 1"
          :href="`/reports/presumptive-tb?page=${meta.current_page - 1}`"
          class="theme-icon-btn rounded px-2 py-1"
        >Prev</Link>
        <span>Page {{ meta.current_page }} / {{ meta.last_page }}</span>
        <Link
          v-if="meta.current_page < meta.last_page"
          :href="`/reports/presumptive-tb?page=${meta.current_page + 1}`"
          class="theme-icon-btn rounded px-2 py-1"
        >Next</Link>
      </div>
    </div>
  </StaffLayout>
</template>
