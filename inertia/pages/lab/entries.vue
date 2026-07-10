<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  entries: {
    id: number
    requested_at: string | null
    request_number: string
    encounter_id: number | null
    encounter_number: string | null
    patient_name: string | null
    priority_level: string | null
    status: string
    test_count: number
    result_count: number
  }[]
}>()

const columns = [
  { key: 'requested_at', label: 'Requested' },
  { key: 'request_number', label: 'Request #' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'priority_level', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'test_count', label: 'Tests' },
  { key: 'result_count', label: 'Results' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Lab Requests</h1></template>
    <DataTable :columns="columns" :rows="entries">
      <template #cell:request_number="{ row }">
        <Link v-if="row.encounter_id" :href="`/lab/${row.encounter_id}`" class="text-blue-600 hover:underline">{{ row.request_number }}</Link>
        <span v-else>{{ row.request_number }}</span>
      </template>
    </DataTable>
  </StaffLayout>
</template>
