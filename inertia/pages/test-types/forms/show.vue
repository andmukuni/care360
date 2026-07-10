<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  form: {
    id: number
    key: string
    label: string
    description: string | null
    templateKey: string | null
    sortOrder: number
    isActive: boolean
    isSystem: boolean
    testTypesCount: number
    catalogCount: number
    fields: {
      id: number
      key: string
      label: string
      fieldType: string
      options: string[]
      placeholder: string | null
      isRequired: boolean
    }[]
    testTypes: { id: number; name: string; category: string | null }[]
  }
}>()

const fieldColumns = [
  { key: 'label', label: 'Label' },
  { key: 'key', label: 'Key' },
  { key: 'fieldType', label: 'Type' },
  { key: 'options', label: 'Options' },
  { key: 'isRequired', label: 'Required' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Result Form: {{ form.label }}</h1></template>

    <div class="mb-6 max-w-lg theme-panel rounded-lg p-6 space-y-3">
      <div><span class="text-sand-11 text-sm">Key:</span> {{ form.key }}</div>
      <div><span class="text-sand-11 text-sm">Template:</span> {{ form.templateKey ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Description:</span> {{ form.description ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Sort order:</span> {{ form.sortOrder }}</div>
      <div><span class="text-sand-11 text-sm">System:</span> {{ form.isSystem ? 'Yes' : 'No' }}</div>
      <div><span class="text-sand-11 text-sm">Active:</span> {{ form.isActive ? 'Yes' : 'No' }}</div>
      <div><span class="text-sand-11 text-sm">Assigned tests:</span> {{ form.testTypesCount }}</div>
      <div class="flex gap-2 pt-2">
        <Link :href="`/test-types/forms/${form.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
        <Link href="/test-types/forms" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
      </div>
    </div>

    <h2 class="mb-2 text-base font-medium">Custom fields</h2>
    <DataTable :columns="fieldColumns" :rows="form.fields" :searchable="false" empty-text="Uses the base template layout.">
      <template #cell:options="{ row }">{{ row.options.length ? row.options.join(', ') : '—' }}</template>
      <template #cell:isRequired="{ row }">{{ row.isRequired ? 'Yes' : 'No' }}</template>
    </DataTable>

    <h2 class="mb-2 mt-6 text-base font-medium">Assigned test types</h2>
    <DataTable
      :columns="[{ key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }]"
      :rows="form.testTypes"
      :searchable="false"
      empty-text="No test types assigned."
    >
      <template #cell:category="{ row }">{{ row.category ?? '—' }}</template>
    </DataTable>
  </StaffLayout>
</template>
