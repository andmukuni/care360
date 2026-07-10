<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  entries: {
    id: number
    reviewed_at: string | null
    encounter_id: number | null
    encounter_number: string | null
    patient_name: string | null
    final_diagnosis: string | null
    prescribed: boolean
  }[]
}>()

const columns = [
  { key: 'reviewed_at', label: 'Reviewed' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'final_diagnosis', label: 'Final diagnosis' },
  { key: 'prescribed', label: 'Rx?' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Screening Review Entries</h1></template>
    <DataTable :columns="columns" :rows="entries">
      <template #cell:encounter_number="{ row }">
        <Link v-if="row.encounter_id" :href="`/screening-review/${row.encounter_id}`" class="text-blue-600 hover:underline">{{ row.encounter_number }}</Link>
        <span v-else>{{ row.encounter_number ?? '—' }}</span>
      </template>
      <template #cell:prescribed="{ row }">{{ row.prescribed ? 'Yes' : 'No' }}</template>
    </DataTable>
  </StaffLayout>
</template>
