<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

interface PatientRow {
  patientId: string
  fullName: string
  gender: string
  dateOfBirth: string | null
  phoneNumber: string
  householdId: string
  barcode: string
  status: string
  isDeceased: boolean
}

defineProps<{
  patients: PatientRow[]
  total: number
  search: string
  householdId: string
}>()

const columns = [
  { key: 'patientId', label: 'Patient ID' },
  { key: 'fullName', label: 'Name' },
  { key: 'gender', label: 'Gender' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'householdId', label: 'Household' },
  { key: 'status', label: 'Status' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Patients</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-sand-11">{{ total }} patients</p>
      <Link href="/patients/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        Register Patient
      </Link>
    </div>

    <DataTable :columns="columns" :rows="patients" :search-keys="['patientId', 'fullName', 'phoneNumber', 'householdId', 'barcode']">
      <template #cell:patientId="{ row }">
        <Link :href="`/patients/${row.patientId}`" class="font-mono text-blue-600 hover:underline">
          {{ row.patientId }}
        </Link>
      </template>
      <template #cell:fullName="{ row }">
        <span :class="row.isDeceased ? 'text-red-600' : ''">{{ row.fullName }}</span>
        <span v-if="row.isDeceased" class="ml-1 text-xs text-red-500">(deceased)</span>
      </template>
      <template #cell:dateOfBirth="{ row }">{{ row.dateOfBirth ?? '—' }}</template>
      <template #cell:phoneNumber="{ row }">{{ row.phoneNumber || '—' }}</template>
      <template #cell:householdId="{ row }">{{ row.householdId || '—' }}</template>
      <template #cell:status="{ row }">
        <span
          class="rounded px-2 py-0.5 text-xs"
          :class="row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-sand-3 text-sand-11'"
        >
          {{ row.status }}
        </span>
      </template>
      <template #actions="{ row }">
        <Link :href="`/patients/${row.patientId}`" class="text-blue-600 hover:underline">View</Link>
        <Link :href="`/patients/${row.patientId}/edit`" class="ml-3 text-blue-600 hover:underline">Edit</Link>
      </template>
    </DataTable>
  </StaffLayout>
</template>
