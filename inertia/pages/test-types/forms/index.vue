<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

defineProps<{
  forms: {
    id: number
    key: string
    label: string
    description: string | null
    sortOrder: number
    isActive: boolean
    isSystem: boolean
    testTypesCount: number
    catalogCount: number
    fieldsCount: number
  }[]
}>()

const columns = [
  { key: 'label', label: 'Label' },
  { key: 'key', label: 'Key' },
  { key: 'sortOrder', label: 'Order' },
  { key: 'testTypesCount', label: 'Tests' },
  { key: 'fieldsCount', label: 'Fields' },
  { key: 'isSystem', label: 'System' },
  { key: 'isActive', label: 'Active' },
]

function destroy(id: number) {
  if (confirm('Delete this result form?')) {
    router.delete(`/test-types/forms/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Lab Result Forms</h1></template>

    <div class="mb-4 flex justify-end gap-2">
      <Link href="/test-types" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Back to test types</Link>
      <Link href="/test-types/forms/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">New Result Form</Link>
    </div>

    <DataTable :columns="columns" :rows="forms">
      <template #cell:label="{ row }">
        <Link :href="`/test-types/forms/${row.id}`" class="text-blue-600 hover:underline">{{ row.label }}</Link>
      </template>
      <template #cell:isSystem="{ row }">{{ row.isSystem ? 'Yes' : 'No' }}</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/test-types/forms/${row.id}/edit`" title="Edit result form" variant="edit" />
          <TableIconButton
            v-if="!row.isSystem"
            variant="delete"
            tone="danger"
            title="Delete result form"
            @click="destroy(row.id)"
          />
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
