<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  prescriptions: {
    id: number
    prescription_number: string
    encounter_id: number | null
    encounter_number: string | null
    patient_name: string | null
    items_count: number
    status: string
    prescribed_at: string | null
    prescribed_by: string | null
    is_locked: boolean
  }[]
}>()

const columns = [
  { key: 'prescription_number', label: 'Rx #' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'items_count', label: 'Items' },
  { key: 'status', label: 'Status' },
  { key: 'prescribed_at', label: 'Prescribed' },
  { key: 'prescribed_by', label: 'By' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Prescriptions</h1></template>
    <DataTable :columns="columns" :rows="prescriptions">
      <template #cell:prescription_number="{ row }">
        <Link v-if="row.encounter_id" :href="`/pharmacy/${row.encounter_id}`" class="text-blue-600 hover:underline">{{ row.prescription_number }}</Link>
        <span v-else>{{ row.prescription_number }}</span>
      </template>
    </DataTable>
  </StaffLayout>
</template>
