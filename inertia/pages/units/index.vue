<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  units: { id: number; name: string; form: string | null; strength: string | null }[]
}>()

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'form', label: 'Form' },
  { key: 'strength', label: 'Strength' },
]

function destroy(id: number) {
  if (confirm('Delete this unit?')) {
    router.delete(`/units/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Units</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/units/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        New Unit
      </Link>
    </div>

    <DataTable :columns="columns" :rows="units">
      <template #cell:name="{ row }">
        <Link :href="`/units/${row.id}`" class="text-blue-600 hover:underline">{{ row.name }}</Link>
      </template>
      <template #actions="{ row }">
        <Link :href="`/units/${row.id}/edit`" class="text-blue-600 hover:underline">Edit</Link>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row.id)">
          Delete
        </button>
      </template>
    </DataTable>
  </StaffLayout>
</template>
