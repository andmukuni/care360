<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  rows: {
    id: number
    test_name: string | null
    test_type_name: string | null
    match_kind: string
    match_value: string | null
    target_field: string
    suggestion_preview: string
    stage_scope: string
    trigger_context: string
    is_active: boolean
    priority: number
  }[]
}>()

const columns = [
  { key: 'test_name', label: 'Test' },
  { key: 'match_kind', label: 'Match kind' },
  { key: 'match_value', label: 'Match value' },
  { key: 'target_field', label: 'Target field' },
  { key: 'suggestion_preview', label: 'Suggestion' },
  { key: 'stage_scope', label: 'Stages' },
  { key: 'priority', label: 'Priority' },
  { key: 'is_active', label: 'Active' },
]

function destroy(id: number) {
  if (confirm('Delete this possible result rule?')) {
    router.delete(`/test-types/possible-results/${id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Possible Results</h1></template>

    <div class="mb-4 flex items-center justify-between gap-2">
      <p class="text-sm text-neutral-600 dark:text-neutral-400">
        Clinical correspondence rules — lab results and context triggers map to suggested diagnoses, notes, and prescriptions.
      </p>
      <div class="flex gap-2">
        <Link href="/test-types" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Test Types</Link>
        <Link href="/test-types/possible-results/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
          New rule
        </Link>
      </div>
    </div>

    <DataTable :columns="columns" :rows="rows" :search-keys="['test_name', 'target_field', 'suggestion_preview', 'match_value']">
      <template #cell:is_active="{ row }">
        <span>{{ row.is_active ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex justify-end gap-2">
          <Link :href="`/test-types/possible-results/${row.id}/edit`" class="text-sm text-blue-600 hover:underline">Edit</Link>
          <button type="button" class="text-sm text-red-600 hover:underline" @click="destroy(row.id)">Delete</button>
        </div>
      </template>
    </DataTable>
  </StaffLayout>
</template>
