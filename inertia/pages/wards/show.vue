<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

defineProps<{
  ward: {
    id: number
    name: string
    type: string
    wing: string
    location: string | null
    notes: string | null
    isActive: boolean
    bedsCount: number
    availableBedsCount: number
    occupiedBedsCount: number
    reservedBedsCount: number
    maintenanceBedsCount: number
  }
  beds: {
    id: number
    bedNumber: string
    status: string
    patientName: string | null
    isActive: boolean
  }[]
}>()

const bedColumns = [
  { key: 'bedNumber', label: 'Bed' },
  { key: 'status', label: 'Status' },
  { key: 'patientName', label: 'Patient' },
]
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Ward: {{ ward.name }}</h1></template>

    <div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
      <div class="theme-panel rounded-lg p-4">
        <div class="text-2xl font-semibold">{{ ward.bedsCount }}</div>
        <div class="text-xs text-sand-11">Total beds</div>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <div class="text-2xl font-semibold text-emerald-600">{{ ward.availableBedsCount }}</div>
        <div class="text-xs text-sand-11">Available</div>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <div class="text-2xl font-semibold text-red-600">{{ ward.occupiedBedsCount }}</div>
        <div class="text-xs text-sand-11">Occupied</div>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <div class="text-2xl font-semibold text-amber-600">{{ ward.reservedBedsCount }}</div>
        <div class="text-xs text-sand-11">Reserved</div>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <div class="text-2xl font-semibold text-sand-11">{{ ward.maintenanceBedsCount }}</div>
        <div class="text-xs text-sand-11">Maintenance</div>
      </div>
    </div>

    <div class="mb-6 max-w-lg theme-panel rounded-lg p-6 space-y-3">
      <div><span class="text-sand-11 text-sm">Wing:</span> {{ ward.wing }}</div>
      <div><span class="text-sand-11 text-sm">Type:</span> {{ ward.type }}</div>
      <div><span class="text-sand-11 text-sm">Location:</span> {{ ward.location ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Active:</span> {{ ward.isActive ? 'Yes' : 'No' }}</div>
      <div v-if="ward.notes"><span class="text-sand-11 text-sm">Notes:</span> {{ ward.notes }}</div>
      <div class="flex gap-2 pt-2">
        <Link :href="`/wards/${ward.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
        <Link href="/wards" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
      </div>
    </div>

    <h2 class="mb-2 text-base font-medium">Beds</h2>
    <DataTable :columns="bedColumns" :rows="beds" empty-text="No beds in this ward.">
      <template #cell:bedNumber="{ row }">
        <Link :href="`/beds/${row.id}`" class="text-blue-600 hover:underline">{{ row.bedNumber }}</Link>
      </template>
      <template #cell:patientName="{ row }">{{ row.patientName ?? '—' }}</template>
    </DataTable>
  </StaffLayout>
</template>
