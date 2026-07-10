<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  patient: Record<string, any>
  encounters: any[]
}>()

const columns = [
  { key: 'encounter_number', label: 'Encounter' },
  { key: 'current_stage', label: 'Stage' },
  { key: 'current_status', label: 'Status' },
  { key: 'visit_type', label: 'Visit Type' },
  { key: 'priority_level', label: 'Priority' },
  { key: 'started_at', label: 'Started' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Encounters — {{ patient.fullName }}</h1></template>

    <div class="mb-4">
      <Link :href="`/patients/${patient.patientId}`" class="text-sm text-blue-600 hover:underline">← Back to patient</Link>
    </div>

    <DataTable :columns="columns" :rows="encounters" empty-text="No encounters recorded.">
      <template #cell:encounter_number="{ row }">
        <span class="font-mono">{{ row.encounter_number }}</span>
      </template>
      <template #cell:visit_type="{ row }">{{ row.visit_type || '—' }}</template>
      <template #cell:priority_level="{ row }">{{ row.priority_level || '—' }}</template>
      <template #cell:started_at="{ row }">
        {{ row.started_at ? String(row.started_at).slice(0, 16).replace('T', ' ') : '—' }}
      </template>
    </DataTable>
  </StaffLayout>
</template>
