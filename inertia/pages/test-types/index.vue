<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

defineProps<{
  testTypes: {
    id: number
    name: string
    description: string | null
    category: string | null
    resultForm: string
    isActive: boolean
  }[]
  categories: string[]
}>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Sample category' },
  { key: 'description', label: 'Discipline' },
  { key: 'resultForm', label: 'Result form' },
  { key: 'isActive', label: 'Active' },
]

async function destroy(id: number) {
  if (!(await confirmDialog('Delete this test type?'))) return
  router.delete(`/test-types/${id}`)
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Test Types</h1></template>

    <div class="mb-4 flex justify-end gap-2">
      <Link href="/test-types/categories" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Categories</Link>
      <Link href="/test-types/forms" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Result forms</Link>
      <Link href="/test-types/possible-results" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Possible Results</Link>
      <Link href="/test-types/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">New Test Type</Link>
    </div>

    <DataTable :columns="columns" :rows="testTypes">
      <template #cell:name="{ row }">
        <Link :href="`/test-types/${row.id}`" class="text-blue-600 hover:underline">{{ row.name }}</Link>
      </template>
      <template #cell:category="{ row }">{{ row.category ?? '—' }}</template>
      <template #cell:description="{ row }">{{ row.description ?? '—' }}</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconLink :href="`/test-types/${row.id}/edit`" title="Edit test type" variant="edit" />
          <TableIconButton variant="delete" tone="danger" title="Delete test type" @click="destroy(row.id)" />
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
