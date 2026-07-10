<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  categories: { category: string; testCount: number; activeCount: number }[]
}>()

const columns = [
  { key: 'category', label: 'Category (discipline)' },
  { key: 'testCount', label: 'Tests' },
  { key: 'activeCount', label: 'Active' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Test Categories</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/test-types" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Back to test types</Link>
    </div>

    <DataTable :columns="columns" :rows="categories" empty-text="No categories yet.">
      <template #cell:category="{ row }">
        <Link :href="`/test-types?category=${encodeURIComponent(row.category)}`" class="text-blue-600 hover:underline">
          {{ row.category }}
        </Link>
      </template>
    </DataTable>
  </StaffLayout>
</template>
