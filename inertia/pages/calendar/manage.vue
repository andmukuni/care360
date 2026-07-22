<script setup lang="ts">
import { ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

interface ManagedEvent {
  id: number
  title: string
  description: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  event_type: string
  location: string | null
  created_by: number
  creator: string | null
}

const props = defineProps<{
  year: number
  month: number
  monthLabel: string
  prev: { year: number; month: number }
  next: { year: number; month: number }
  allEvents: ManagedEvent[]
  eventTypes: Record<string, string>
  type: string
}>()

const columns = [
  { key: 'event_date', label: 'Date' },
  { key: 'start_time', label: 'Time' },
  { key: 'title', label: 'Title' },
  { key: 'event_type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'creator', label: 'Created by' },
]

const typeFilter = ref(props.type)

function applyFilter() {
  router.get('/calendar/manage', { year: props.year, month: props.month, type: typeFilter.value }, { preserveState: true })
}

async function destroy(ev: ManagedEvent) {
  if (!(await confirmDialog('Delete this event?'))) return
  router.delete(`/calendar/events/${ev.id}`)
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Manage Calendar</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Link
          :href="`/calendar/manage?year=${props.prev.year}&month=${props.prev.month}&type=${props.type}`"
          class="theme-icon-btn rounded px-2 py-1 text-sm"
        >
          ‹ Prev
        </Link>
        <span class="text-base font-medium">{{ props.monthLabel }}</span>
        <Link
          :href="`/calendar/manage?year=${props.next.year}&month=${props.next.month}&type=${props.type}`"
          class="theme-icon-btn rounded px-2 py-1 text-sm"
        >
          Next ›
        </Link>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="typeFilter" class="theme-icon-btn rounded px-2 py-1 text-sm" @change="applyFilter">
          <option value="">All types</option>
          <option v-for="(label, value) in props.eventTypes" :key="value" :value="value">{{ label }}</option>
        </select>
        <Link href="/calendar" class="text-sm text-blue-600 hover:underline">Calendar view</Link>
      </div>
    </div>

    <DataTable :columns="columns" :rows="props.allEvents" :search-keys="['title', 'location', 'creator']">
      <template #cell:event_type="{ row }">{{ props.eventTypes[row.event_type] ?? row.event_type }}</template>
      <template #cell:location="{ row }">{{ row.location ?? '—' }}</template>
      <template #cell:creator="{ row }">{{ row.creator ?? '—' }}</template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconButton variant="delete" tone="danger" title="Delete event" @click="destroy(row)" />
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
