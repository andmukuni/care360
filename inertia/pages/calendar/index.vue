<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

interface CalendarEventItem {
  id: number
  title: string
  description: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  event_type: string
  location: string | null
  created_by: number
}

const props = defineProps<{
  year: number
  month: number
  monthLabel: string
  prev: { year: number; month: number }
  next: { year: number; month: number }
  events: CalendarEventItem[]
  upcoming: CalendarEventItem[]
  isAdmin: boolean
  eventTypes: Record<string, string>
  currentUserId: number
}>()

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const eventsByDate = computed(() => {
  const map: Record<string, CalendarEventItem[]> = {}
  for (const ev of props.events) {
    if (!ev.event_date) continue
    ;(map[ev.event_date] ??= []).push(ev)
  }
  return map
})

const grid = computed(() => {
  const first = new Date(props.year, props.month - 1, 1)
  const startOffset = first.getDay()
  const daysInMonth = new Date(props.year, props.month, 0).getDate()
  const cells: { date: string | null; day: number | null }[] = []
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(props.month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ date: `${props.year}-${mm}-${dd}`, day: d })
  }
  return cells
})

const typeColor: Record<string, string> = {
  appointment: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  reminder: 'bg-amber-100 text-amber-700',
  other: 'bg-sand-3 text-sand-11',
}

function canManage(ev: CalendarEventItem): boolean {
  return props.isAdmin || ev.created_by === props.currentUserId
}

// ── Create / edit ──────────────────────────────────────────────────────────
const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = useForm({
  title: '',
  description: '',
  event_date: '',
  start_time: '',
  end_time: '',
  event_type: 'appointment',
  location: '',
})

function openCreate(date?: string) {
  editingId.value = null
  form.reset()
  form.event_date = date ?? `${props.year}-${String(props.month).padStart(2, '0')}-01`
  showForm.value = true
}

function openEdit(ev: CalendarEventItem) {
  editingId.value = ev.id
  form.title = ev.title
  form.description = ev.description ?? ''
  form.event_date = ev.event_date ?? ''
  form.start_time = ev.start_time ?? ''
  form.end_time = ev.end_time ?? ''
  form.event_type = ev.event_type
  form.location = ev.location ?? ''
  detailEvent.value = null
  showForm.value = true
}

function submit() {
  const options = {
    onSuccess: () => {
      showForm.value = false
      form.reset()
    },
  }
  if (editingId.value) {
    form.put(`/calendar/events/${editingId.value}`, options)
  } else {
    form.post('/calendar/events', options)
  }
}

// ── Detail ───────────────────────────────────────────────────────────────
const detailEvent = ref<CalendarEventItem | null>(null)

async function destroy(ev: CalendarEventItem) {
  if (!(await confirmDialog('Delete this event?'))) return
  router.delete(`/calendar/events/${ev.id}`, {
    onSuccess: () => {
      detailEvent.value = null
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Calendar</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Link
          :href="`/calendar?year=${props.prev.year}&month=${props.prev.month}`"
          class="theme-icon-btn rounded px-2 py-1 text-sm"
        >
          ‹ Prev
        </Link>
        <span class="text-base font-medium">{{ props.monthLabel }}</span>
        <Link
          :href="`/calendar?year=${props.next.year}&month=${props.next.month}`"
          class="theme-icon-btn rounded px-2 py-1 text-sm"
        >
          Next ›
        </Link>
      </div>
      <div class="flex items-center gap-2">
        <Link v-if="props.isAdmin" href="/calendar/manage" class="text-sm text-blue-600 hover:underline">Manage</Link>
        <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="openCreate()">
          New Event
        </button>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-4">
      <div class="lg:col-span-3">
        <div class="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-sand-6 bg-sand-6">
          <div v-for="wd in WEEKDAYS" :key="wd" class="bg-white px-2 py-1 text-center text-xs font-medium text-sand-11">
            {{ wd }}
          </div>
          <div
            v-for="(cell, i) in grid"
            :key="i"
            class="min-h-24 bg-white p-1"
            :class="cell.date ? 'cursor-pointer hover:bg-sand-2' : 'bg-sand-2'"
            @click="cell.date && openCreate(cell.date)"
          >
            <div v-if="cell.day" class="mb-1 text-xs text-sand-11">{{ cell.day }}</div>
            <div class="space-y-0.5">
              <button
                v-for="ev in eventsByDate[cell.date ?? ''] ?? []"
                :key="ev.id"
                type="button"
                class="block w-full truncate rounded px-1 py-0.5 text-left text-xs"
                :class="typeColor[ev.event_type] ?? 'bg-sand-3'"
                @click.stop="detailEvent = ev"
              >
                <span v-if="ev.start_time">{{ ev.start_time }} </span>{{ ev.title }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside>
        <h3 class="mb-2 text-sm font-medium text-sand-11">Upcoming</h3>
        <ul class="space-y-2">
          <li v-if="!props.upcoming.length" class="text-sm text-sand-11">Nothing upcoming.</li>
          <li
            v-for="ev in props.upcoming"
            :key="ev.id"
            class="cursor-pointer theme-panel rounded-lg p-3 text-sm hover:bg-sand-2"
            @click="detailEvent = ev"
          >
            <div class="font-medium">{{ ev.title }}</div>
            <div class="text-xs text-sand-11">{{ ev.event_date }} <span v-if="ev.start_time">· {{ ev.start_time }}</span></div>
          </li>
        </ul>
      </aside>
    </div>

    <!-- Detail modal -->
    <div v-if="detailEvent" class="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md theme-surface rounded-lg p-6 shadow-lg">
        <div class="mb-2 flex items-center gap-2">
          <span class="rounded px-2 py-0.5 text-xs" :class="typeColor[detailEvent.event_type] ?? 'bg-sand-3'">
            {{ props.eventTypes[detailEvent.event_type] ?? detailEvent.event_type }}
          </span>
        </div>
        <h2 class="text-lg font-semibold">{{ detailEvent.title }}</h2>
        <div class="mt-1 text-sm text-sand-11">
          {{ detailEvent.event_date }}
          <span v-if="detailEvent.start_time">· {{ detailEvent.start_time }}<span v-if="detailEvent.end_time">–{{ detailEvent.end_time }}</span></span>
        </div>
        <p v-if="detailEvent.location" class="mt-1 text-sm">📍 {{ detailEvent.location }}</p>
        <p v-if="detailEvent.description" class="mt-3 whitespace-pre-line text-sm">{{ detailEvent.description }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <template v-if="canManage(detailEvent)">
            <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm" @click="openEdit(detailEvent)">Edit</button>
            <button type="button" class="rounded px-3 py-1.5 text-sm text-red-600" @click="destroy(detailEvent)">Delete</button>
          </template>
          <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="detailEvent = null">Close</button>
        </div>
      </div>
    </div>

    <!-- Create / edit modal -->
    <div v-if="showForm" class="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-lg theme-surface rounded-lg p-6 shadow-lg">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Event' : 'New Event' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div>
            <label class="block text-sm font-medium mb-1">Title</label>
            <input v-model="form.title" type="text" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.title" class="mt-1 text-sm text-red-600">{{ form.errors.title }}</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium mb-1">Date</label>
              <input v-model="form.event_date" type="date" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.event_date" class="mt-1 text-sm text-red-600">{{ form.errors.event_date }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Type</label>
              <select v-model="form.event_type" class="theme-field w-full rounded px-3 py-2">
                <option v-for="(label, value) in props.eventTypes" :key="value" :value="value">{{ label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Start Time</label>
              <input v-model="form.start_time" type="time" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.start_time" class="mt-1 text-sm text-red-600">{{ form.errors.start_time }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">End Time</label>
              <input v-model="form.end_time" type="time" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.end_time" class="mt-1 text-sm text-red-600">{{ form.errors.end_time }}</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Location</label>
            <input v-model="form.location" type="text" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Description</label>
            <textarea v-model="form.description" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">{{ editingId ? 'Update' : 'Create' }}</ActionButton>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
