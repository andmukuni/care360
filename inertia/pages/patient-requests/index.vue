<script setup lang="ts">
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

interface Request {
  id: number
  requestType: string
  details: string | null
  status: string
  createdAt: string | null
  patient: {
    id: number
    patientNumber: string
    fullName: string
    phoneNumber: string | null
  } | null
}

const props = defineProps<{ requests: Request[] }>()

const columns = [
  { key: 'patientName', label: 'Patient' },
  { key: 'requestType', label: 'Request Type' },
  { key: 'details', label: 'Details' },
  { key: 'createdAt', label: 'Submitted' },
]

const rows = props.requests.map((r) => ({
  ...r,
  patientName: r.patient?.fullName ?? '—',
}))
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Patient Requests</h1></template>

    <DataTable :columns="columns" :rows="rows" :search-keys="['patientName', 'requestType', 'details']">
      <template #cell:patientName="{ row }">
        {{ row.patient?.fullName ?? '—' }}
        <div class="text-xs text-sand-11">{{ row.patient?.patientNumber }} · {{ row.patient?.phoneNumber ?? '—' }}</div>
      </template>
      <template #cell:requestType="{ row }"><span class="capitalize">{{ row.requestType }}</span></template>
      <template #cell:details="{ row }"><span class="line-clamp-2">{{ row.details ?? '—' }}</span></template>
    </DataTable>
  </StaffLayout>
</template>
