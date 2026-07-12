<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

const props = defineProps<{
  beds: {
    id: number
    bedNumber: string
    wardId: number
    wardName: string | null
    wing: string | null
    status: string
    patientName: string | null
    admittedAt: string | null
    isActive: boolean
  }[]
  wards: { id: number; name: string; wing: string }[]
  wings: string[]
  statuses: string[]
  statusCounts: Record<string, number>
  filters: { status: string; wardId: number | null; wing: string | null; search: string }
}>()

const columns = [
  { key: 'bedNumber', label: 'Bed' },
  { key: 'wardName', label: 'Ward' },
  { key: 'wing', label: 'Wing' },
  { key: 'status', label: 'Status' },
  { key: 'patientName', label: 'Patient' },
  { key: 'admittedAt', label: 'Admitted' },
]

const tabs = ['all', ...props.statuses]

function tabHref(status: string) {
  const q = new URLSearchParams()
  q.set('status', status)
  if (props.filters.wardId) q.set('ward_id', String(props.filters.wardId))
  if (props.filters.wing) q.set('wing', props.filters.wing)
  return `/beds?${q.toString()}`
}

function destroy(id: number) {
  if (confirm('Delete this bed?')) {
    router.delete(`/beds/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Beds</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <div class="flex flex-wrap gap-2">
        <Link
          v-for="t in tabs"
          :key="t"
          :href="tabHref(t)"
          class="rounded border px-3 py-1 text-sm capitalize"
          :class="filters.status === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-sand-6'"
        >
          {{ t }} ({{ statusCounts[t] ?? 0 }})
        </Link>
      </div>
      <Link href="/beds/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">New Bed</Link>
    </div>

    <DataTable :columns="columns" :rows="beds">
      <template #cell:bedNumber="{ row }">
        <Link :href="`/beds/${row.id}`" class="text-blue-600 hover:underline">{{ row.bedNumber }}</Link>
      </template>
      <template #cell:wardName="{ row }">{{ row.wardName ?? '—' }}</template>
      <template #cell:wing="{ row }">{{ row.wing ?? '—' }}</template>
      <template #cell:status="{ row }"><span class="capitalize">{{ row.status }}</span></template>
      <template #cell:patientName="{ row }">{{ row.patientName ?? '—' }}</template>
      <template #cell:admittedAt="{ row }">{{ row.admittedAt ?? '—' }}</template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/beds/${row.id}/edit`" title="Edit bed" variant="edit" />
          <TableIconButton variant="delete" tone="danger" title="Delete bed" @click="destroy(row.id)" />
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
