<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  results: {
    id: number
    recorded_at: string | null
    encounter_id: number | null
    encounter_number: string | null
    patient_name: string | null
    test_name: string | null
    result_value: string | null
    interpretation: string | null
    result_status: string
    recorded_by: string | null
  }[]
}>()

const columns = [
  { key: 'recorded_at', label: 'Recorded' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'test_name', label: 'Test' },
  { key: 'result_value', label: 'Result' },
  { key: 'interpretation', label: 'Interpretation' },
  { key: 'recorded_by', label: 'By' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Lab Test Results</h1></template>
    <DataTable :columns="columns" :rows="results">
      <template #cell:encounter_number="{ row }">
        <Link v-if="row.encounter_id" :href="`/lab/${row.encounter_id}`" class="text-blue-600 hover:underline">{{ row.encounter_number }}</Link>
        <span v-else>{{ row.encounter_number ?? '—' }}</span>
      </template>
    </DataTable>
  </StaffLayout>
</template>
