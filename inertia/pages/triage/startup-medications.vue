<script setup lang="ts">
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  medications: {
    id: number
    medication_name: string
    dosage: string | null
    route: string | null
    frequency: string | null
    source: string
    status: string
    patient_name: string | null
    encounter_number: string | null
    recorded_by: string | null
    created_at: string | null
  }[]
  search: string
}>()

const columns = [
  { key: 'created_at', label: 'Recorded' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'medication_name', label: 'Medication' },
  { key: 'dosage', label: 'Dosage' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Startup Medications</h1></template>
    <DataTable :columns="columns" :rows="medications" />
  </StaffLayout>
</template>
