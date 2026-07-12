<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

defineProps<{
  specimenTypes: {
    id: number
    name: string
    code: string | null
    defaultUnit: string | null
    testCategory: string | null
    sortOrder: number
    isActive: boolean
    linkedTests: number
  }[]
}>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'testCategory', label: 'Category' },
  { key: 'code', label: 'Code' },
  { key: 'defaultUnit', label: 'Default unit' },
  { key: 'sortOrder', label: 'Order' },
  { key: 'linkedTests', label: 'Tests' },
  { key: 'isActive', label: 'Active' },
]

function destroy(id: number) {
  if (confirm('Delete this sample type?')) {
    router.delete(`/lab/specimen-types/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Test Sample Types</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/lab/specimen-types/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        New Sample Type
      </Link>
    </div>

    <DataTable :columns="columns" :rows="specimenTypes">
      <template #cell:name="{ row }">
        <Link :href="`/lab/specimen-types/${row.id}`" class="text-blue-600 hover:underline">{{ row.name }}</Link>
      </template>
      <template #cell:testCategory="{ row }">{{ row.testCategory ?? '—' }}</template>
      <template #cell:code="{ row }">{{ row.code ?? '—' }}</template>
      <template #cell:defaultUnit="{ row }">{{ row.defaultUnit ?? '—' }}</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/lab/specimen-types/${row.id}/edit`" title="Edit sample type" variant="edit" />
          <TableIconButton variant="delete" tone="danger" title="Delete sample type" @click="destroy(row.id)" />
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
