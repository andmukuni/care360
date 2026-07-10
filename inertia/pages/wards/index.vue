<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  wards: {
    id: number
    name: string
    wing: string
    type: string
    location: string | null
    bedsCount: number
    isActive: boolean
  }[]
}>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'wing', label: 'Wing' },
  { key: 'type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'bedsCount', label: 'Beds' },
  { key: 'isActive', label: 'Active' },
]

function destroy(id: number) {
  if (confirm('Delete this ward?')) {
    router.delete(`/wards/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Wards</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/wards/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        New Ward
      </Link>
    </div>

    <DataTable :columns="columns" :rows="wards">
      <template #cell:name="{ row }">
        <Link :href="`/wards/${row.id}`" class="text-blue-600 hover:underline">{{ row.name }}</Link>
      </template>
      <template #cell:location="{ row }">{{ row.location ?? '—' }}</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">
          {{ row.isActive ? 'Yes' : 'No' }}
        </span>
      </template>
      <template #actions="{ row }">
        <Link :href="`/wards/${row.id}/edit`" class="text-blue-600 hover:underline">Edit</Link>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row.id)">
          Delete
        </button>
      </template>
    </DataTable>
  </StaffLayout>
</template>
