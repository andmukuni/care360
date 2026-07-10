<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface Slot {
  shift_type: string
  patients: number
}
interface StaffBoardRow {
  user: { id: number; name: string; email: string; profile_photo_path: string | null }
  slots: Record<string, Slot[]>
  assigned_days: number
  encounter_count: number
}

const props = defineProps<{
  selectedShift: string | null
  selectedMonth: string
  shiftDefinitions: Record<string, { label: string; start: string; end: string }>
  weekStart: string
  weekEnd: string
  weekDays: string[]
  daySummaries: Record<string, { total_patients: number; report_count: number; staff_count: number; day_patients: number; night_patients: number }>
  staffBoardRows: StaffBoardRow[]
  weeklyTotals: { patients: number; reports: number; staff: number }
  prevWeekStart: string
  nextWeekStart: string
}>()

function dayLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}
function shiftFilterHref(shift: string | null) {
  const params = new URLSearchParams({ week_start: props.weekStart })
  if (shift) params.set('shift', shift)
  return `/reports/shifts/timeline?${params.toString()}`
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Shift Timeline</h1></template>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Link :href="`/reports/shifts/timeline?week_start=${prevWeekStart}`" class="theme-icon-btn rounded px-2 py-1 text-sm">‹ Prev</Link>
        <span class="text-sm font-medium">{{ weekStart }} — {{ weekEnd }}</span>
        <Link :href="`/reports/shifts/timeline?week_start=${nextWeekStart}`" class="theme-icon-btn rounded px-2 py-1 text-sm">Next ›</Link>
        <Link href="/reports/shifts" class="ml-2 rounded border border-sand-6 px-2 py-1 text-sm">Roster</Link>
      </div>
      <div class="flex items-center gap-1">
        <Link :href="shiftFilterHref(null)" class="rounded px-2 py-1 text-sm" :class="!selectedShift ? 'bg-blue-600 text-white' : 'border border-sand-6'">All</Link>
        <Link
          v-for="(def, key) in shiftDefinitions"
          :key="key"
          :href="shiftFilterHref(String(key))"
          class="rounded px-2 py-1 text-sm"
          :class="selectedShift === key ? 'bg-blue-600 text-white' : 'border border-sand-6'"
        >{{ def.label }}</Link>
      </div>
    </div>

    <div class="mb-6 grid grid-cols-3 gap-3">
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Patients</p>
        <p class="text-2xl font-semibold">{{ weeklyTotals.patients }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Encounters</p>
        <p class="text-2xl font-semibold">{{ weeklyTotals.reports }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Staff</p>
        <p class="text-2xl font-semibold">{{ weeklyTotals.staff }}</p>
      </div>
    </div>

    <div class="overflow-x-auto theme-panel rounded-lg">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-sand-6 text-left text-sand-11">
            <th class="px-3 py-2 font-medium">Staff</th>
            <th v-for="day in weekDays" :key="day" class="px-3 py-2 text-center font-medium">{{ dayLabel(day) }}</th>
            <th class="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in staffBoardRows" :key="row.user.id" class="border-b border-sand-4">
            <td class="px-3 py-2 font-medium">{{ row.user.name }}</td>
            <td v-for="day in weekDays" :key="day" class="px-3 py-2 text-center">
              <template v-if="(row.slots[day] ?? []).length">
                <span
                  v-for="slot in row.slots[day]"
                  :key="slot.shift_type"
                  class="mx-0.5 inline-block rounded px-1.5 py-0.5 text-xs"
                  :class="slot.shift_type === 'night' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'"
                >{{ slot.patients }}</span>
              </template>
              <span v-else class="text-sand-6">—</span>
            </td>
            <td class="px-3 py-2 text-right font-medium">{{ row.encounter_count }}</td>
          </tr>
          <tr v-if="!staffBoardRows.length">
            <td :colspan="weekDays.length + 2" class="px-3 py-6 text-center text-sand-11">
              No shift activity for this week.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </StaffLayout>
</template>
