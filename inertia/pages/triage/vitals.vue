<script setup lang="ts">
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  records: {
    id: number
    triage_at: string | null
    patient_name: string | null
    encounter_number: string | null
    weight: number | null
    height: number | null
    bmi: number | null
    temperature: number | null
    pulse: number | null
    systolic_bp: number | null
    diastolic_bp: number | null
  }[]
  search: string
}>()

const columns = [
  { key: 'triage_at', label: 'Recorded' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'weight', label: 'Wt' },
  { key: 'temperature', label: 'Temp' },
  { key: 'pulse', label: 'Pulse' },
  { key: 'bp', label: 'BP' },
  { key: 'bmi', label: 'BMI' },
]

const rows = (records: any[]) =>
  records.map((r) => ({ ...r, bp: r.systolic_bp && r.diastolic_bp ? `${r.systolic_bp}/${r.diastolic_bp}` : '—' }))
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Triage Vitals</h1></template>
    <DataTable :columns="columns" :rows="rows(records)" />
  </StaffLayout>
</template>
