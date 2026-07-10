<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

const props = defineProps<{
  date: string
  attendantType: string | null
  counts: { all: number; first_attendant: number; re_attendant: number }
  encounters: {
    id: number
    encounter_number: string
    patient_name: string | null
    patient_code: string | null
    gender: string | null
    attendant_type: string | null
    was_existing_patient: boolean | null
    started_at: string | null
    chief_complaint: string | null
  }[]
}>()

const date = ref(props.date)
const attendant = ref(props.attendantType ?? '')

function applyFilters() {
  router.get('/reports/opd-register', {
    date: date.value,
    attendant_type: attendant.value || undefined,
  })
}

const columns = [
  { key: 'started_at', label: 'Time' },
  { key: 'encounter_number', label: 'Encounter #' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'gender', label: 'Gender' },
  { key: 'attendant_type', label: 'Attendant' },
  { key: 'chief_complaint', label: 'Chief complaint' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">OPD Register</h1></template>

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="mb-1 block text-xs text-sand-11">Date</label>
        <input v-model="date" type="date" class="rounded border border-sand-6 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-sand-11">Attendant type</label>
        <select v-model="attendant" class="rounded border border-sand-6 px-2 py-1.5 text-sm">
          <option value="">All ({{ counts.all }})</option>
          <option value="first_attendant">First attendant ({{ counts.first_attendant }})</option>
          <option value="re_attendant">Re-attendant ({{ counts.re_attendant }})</option>
        </select>
      </div>
      <button type="button" class="rounded bg-blue-600 px-4 py-2 text-sm text-white" @click="applyFilters">Apply</button>
    </div>

    <DataTable :columns="columns" :rows="encounters">
      <template #cell:attendant_type="{ row }">
        {{ row.was_existing_patient ? 'Re-attendant' : 'First attendant' }}
      </template>
    </DataTable>
  </StaffLayout>
</template>
