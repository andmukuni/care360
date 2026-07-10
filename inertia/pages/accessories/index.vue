<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  accessories: {
    id: number
    label: string
    name: string | null
    assetTag: string | null
    type: string | null
    status: string
    bedId: number | null
    bedNumber: string | null
    wardName: string | null
    location: string
  }[]
  types: { id: number; name: string }[]
  statuses: string[]
  filters: { typeId: number | null; status: string | null; location: string | null }
}>()

const columns = [
  { key: 'type', label: 'Type' },
  { key: 'label', label: 'Accessory' },
  { key: 'assetTag', label: 'Asset tag' },
  { key: 'status', label: 'Status' },
  { key: 'location', label: 'Location' },
  { key: 'bedNumber', label: 'Bed' },
]

function detach(id: number) {
  if (confirm('Detach this accessory to storage?')) {
    router.post(`/accessories/${id}/detach`)
  }
}

function destroy(id: number) {
  if (confirm('Delete this accessory?')) {
    router.delete(`/accessories/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Bed Accessories</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/accessories/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        New Accessory
      </Link>
    </div>

    <DataTable :columns="columns" :rows="accessories">
      <template #cell:type="{ row }">{{ row.type ?? '—' }}</template>
      <template #cell:assetTag="{ row }">{{ row.assetTag ?? '—' }}</template>
      <template #cell:status="{ row }"><span class="capitalize">{{ row.status }}</span></template>
      <template #cell:bedNumber="{ row }">
        <span v-if="row.bedNumber">{{ row.bedNumber }} ({{ row.wardName ?? '—' }})</span>
        <span v-else>—</span>
      </template>
      <template #actions="{ row }">
        <Link :href="`/accessories/${row.id}/edit`" class="text-blue-600 hover:underline">Edit</Link>
        <button v-if="row.bedId" type="button" class="ml-3 text-amber-700 hover:underline" @click="detach(row.id)">
          Detach
        </button>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row.id)">Delete</button>
      </template>
    </DataTable>
  </StaffLayout>
</template>
