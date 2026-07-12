<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

defineProps<{
  medications: {
    id: number
    name: string
    unit: string | null
    genericName: string | null
    category: string
    defaultRoute: string | null
    defaultFrequency: string | null
    isControlled: boolean
    isActive: boolean
  }[]
  categories: string[]
  search: string
  category: string
}>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'unit', label: 'Unit' },
  { key: 'genericName', label: 'Generic' },
  { key: 'category', label: 'Category' },
  { key: 'defaultRoute', label: 'Route' },
  { key: 'isControlled', label: 'Controlled' },
  { key: 'isActive', label: 'Active' },
]

function destroy(id: number) {
  if (confirm('Delete this medication?')) {
    router.delete(`/medications/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Medications</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/medications/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        New Medication
      </Link>
    </div>

    <DataTable :columns="columns" :rows="medications">
      <template #cell:name="{ row }">
        <Link :href="`/medications/${row.id}`" class="text-blue-600 hover:underline">{{ row.name }}</Link>
      </template>
      <template #cell:unit="{ row }">{{ row.unit ?? '—' }}</template>
      <template #cell:genericName="{ row }">{{ row.genericName ?? '—' }}</template>
      <template #cell:defaultRoute="{ row }">{{ row.defaultRoute ?? '—' }}</template>
      <template #cell:isControlled="{ row }">{{ row.isControlled ? 'Yes' : 'No' }}</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/medications/${row.id}/edit`" title="Edit medication" variant="edit" />
          <TableIconButton variant="delete" tone="danger" title="Delete medication" @click="destroy(row.id)" />
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
