<script setup lang="ts">
import { reactive } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

interface RosterAssignment {
  id: number
  shift_date: string
  shift_type: string
  user_id: number
  user: { id: number; name: string; email: string } | null
  start_time: string | null
  end_time: string | null
  notes: string | null
}
interface ShiftDefinition {
  label: string
  start: string
  end: string
}

const props = defineProps<{
  summary: { total_reports: number; total_staff: number; patients_today: number; patients_this_month: number }
  currentShift: { key: string; label: string; start: string; end: string } | null
  shiftDefinitions: Record<string, ShiftDefinition>
  staffCandidates: { id: number; name: string; email: string; profile_photo_path: string | null }[]
  rosterAssignments: Record<string, RosterAssignment[]>
  currentShiftRoster: RosterAssignment[]
  weekStart: string
  weekEnd: string
  weekDays: string[]
  rosterDaySummary: Record<string, Record<string, number>>
  weeklyRosterTotals: { assignments: number; staff: number }
  prefillWeekStart: string
  prefillWeekEnd: string
  prevWeekStart: string
  nextWeekStart: string
}>()

const form = useForm({
  shift_date: props.weekDays[0],
  shift_type: Object.keys(props.shiftDefinitions)[0],
  user_id: props.staffCandidates[0]?.id ?? null,
  start_time: props.shiftDefinitions[Object.keys(props.shiftDefinitions)[0]]?.start ?? '07:00',
  end_time: props.shiftDefinitions[Object.keys(props.shiftDefinitions)[0]]?.end ?? '18:59',
  notes: '',
})

const ui = reactive({ showForm: false })

function onShiftTypeChange() {
  const def = props.shiftDefinitions[form.shift_type]
  if (def) {
    form.start_time = def.start
    form.end_time = def.end
  }
}

function submit() {
  form.post('/reports/shifts/roster', {
    preserveScroll: true,
    onSuccess: () => {
      ui.showForm = false
      form.reset('notes')
    },
  })
}

async function removeAssignment(id: number) {
  if (!(await confirmDialog('Remove this assignment?'))) return
  router.delete(`/reports/shifts/roster/${id}`, { preserveScroll: true })
}

function prefill() {
  router.post('/reports/shifts/prefill', { week_start: props.weekStart, return_to: 'index' }, { preserveScroll: true })
}

function dayLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Shift Management</h1></template>

    <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Total reports</p>
        <p class="text-2xl font-semibold">{{ summary.total_reports }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Shift staff</p>
        <p class="text-2xl font-semibold">{{ summary.total_staff }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Patients today</p>
        <p class="text-2xl font-semibold">{{ summary.patients_today }}</p>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <p class="text-xs text-sand-11">Patients this month</p>
        <p class="text-2xl font-semibold">{{ summary.patients_this_month }}</p>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Link :href="`/reports/shifts?week_start=${prevWeekStart}`" class="theme-icon-btn rounded px-2 py-1 text-sm">‹ Prev</Link>
        <span class="text-sm font-medium">{{ weekStart }} — {{ weekEnd }}</span>
        <Link :href="`/reports/shifts?week_start=${nextWeekStart}`" class="theme-icon-btn rounded px-2 py-1 text-sm">Next ›</Link>
        <Link href="/reports/shifts/timeline" class="ml-2 rounded border border-sand-6 px-2 py-1 text-sm">Timeline</Link>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="currentShift" class="rounded bg-violet-100 px-2 py-1 text-xs text-violet-700">
          On now: {{ currentShift.label }} ({{ currentShift.start }}–{{ currentShift.end }})
        </span>
        <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm hover:bg-sand-2" @click="prefill">
          Auto-prefill next week
        </button>
        <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="ui.showForm = !ui.showForm">
          Add assignment
        </button>
      </div>
    </div>

    <!-- Add assignment form -->
    <form v-if="ui.showForm" class="mb-6 grid gap-3 theme-panel rounded-lg p-4 sm:grid-cols-6" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-xs text-sand-11">Date</label>
        <select v-model="form.shift_date" class="theme-field w-full rounded px-2 py-1.5 text-sm">
          <option v-for="d in weekDays" :key="d" :value="d">{{ dayLabel(d) }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs text-sand-11">Shift</label>
        <select v-model="form.shift_type" class="theme-field w-full rounded px-2 py-1.5 text-sm" @change="onShiftTypeChange">
          <option v-for="(def, key) in shiftDefinitions" :key="key" :value="key">{{ def.label }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs text-sand-11">Staff</label>
        <select v-model="form.user_id" class="theme-field w-full rounded px-2 py-1.5 text-sm">
          <option v-for="s in staffCandidates" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs text-sand-11">Start</label>
        <input v-model="form.start_time" type="time" class="theme-field w-full rounded px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-sand-11">End</label>
        <input v-model="form.end_time" type="time" class="theme-field w-full rounded px-2 py-1.5 text-sm" />
      </div>
      <div class="flex items-end">
        <ActionButton type="submit" variant="blue" class="w-full" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
      </div>
      <div class="sm:col-span-6">
        <input v-model="form.notes" type="text" placeholder="Notes (optional)" class="theme-field w-full rounded px-2 py-1.5 text-sm" />
      </div>
    </form>

    <!-- Roster board -->
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <div v-for="day in weekDays" :key="day" class="theme-panel rounded-lg p-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">{{ dayLabel(day) }}</span>
          <span class="text-xs text-sand-11">{{ rosterDaySummary[day]?.total_count ?? 0 }}</span>
        </div>
        <ul class="space-y-2">
          <li
            v-for="a in (rosterAssignments[day] ?? [])"
            :key="a.id"
            class="rounded border border-sand-4 px-2 py-1.5 text-xs"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ a.user?.name ?? 'Unknown' }}</span>
              <button type="button" class="text-red-600 hover:underline" @click="removeAssignment(a.id)">✕</button>
            </div>
            <div class="text-sand-11">
              {{ shiftDefinitions[a.shift_type]?.label ?? a.shift_type }} · {{ a.start_time }}–{{ a.end_time }}
            </div>
          </li>
          <li v-if="!(rosterAssignments[day] ?? []).length" class="py-2 text-center text-xs text-sand-11">
            No assignments
          </li>
        </ul>
      </div>
    </div>

    <p class="mt-4 text-sm text-sand-11">
      Week totals: {{ weeklyRosterTotals.assignments }} assignment(s), {{ weeklyRosterTotals.staff }} staff.
    </p>
  </StaffLayout>
</template>
