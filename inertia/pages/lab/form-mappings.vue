<script setup lang="ts">
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  rows: { name: string; group: string; specimen: string; form_key: string; form_label: string }[]
  counts: Record<string, number>
}>()

const columns = [
  { key: 'name', label: 'Test' },
  { key: 'group', label: 'Group' },
  { key: 'specimen', label: 'Specimen' },
  { key: 'form_label', label: 'Result form' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Lab Form Mappings</h1></template>
    <div class="mb-4 flex flex-wrap gap-2 text-sm">
      <span v-for="(count, key) in counts" :key="key" class="rounded bg-sand-3 px-3 py-1">
        {{ key }}: {{ count }}
      </span>
    </div>
    <DataTable :columns="columns" :rows="rows" />
  </StaffLayout>
</template>
