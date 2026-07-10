<script setup lang="ts">
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  bed: {
    id: number
    bedNumber: string
    wardId: number
    wardName: string | null
    wing: string | null
    status: string
    patientName: string | null
    admittedAt: string | null
    dischargedAt: string | null
    notes: string | null
    isActive: boolean
    patient: { fullName: string } | null
    accessories: { id: number; name: string | null; assetTag: string | null; status: string; type: string | null }[]
    assignments: {
      id: number
      patientName: string | null
      admittedAt: string | null
      dischargedAt: string | null
      admittedBy: string | null
      dischargedBy: string | null
    }[]
  }
  siblings: { id: number; bedNumber: string; status: string }[]
  allWardsWithBeds: { id: number; name: string; wing: string; beds: { id: number; bedNumber: string }[] }[]
  statuses: string[]
}>()

const statusForm = useForm({
  status: props.bed.status,
  patient_name: props.bed.patientName ?? '',
  notes: props.bed.notes ?? '',
})

const moveForm = useForm({
  ward_id: props.bed.wardId,
  bed_number: props.bed.bedNumber,
  reason: '',
})

function submitStatus() {
  statusForm.patch(`/beds/${props.bed.id}/status`)
}

function submitMove() {
  moveForm.patch(`/beds/${props.bed.id}/move`)
}

function discharge() {
  if (confirm('Discharge this bed?')) {
    router.post(`/beds/${props.bed.id}/discharge`)
  }
}

const assignmentColumns = [
  { key: 'patientName', label: 'Patient' },
  { key: 'admittedAt', label: 'Admitted' },
  { key: 'dischargedAt', label: 'Discharged' },
  { key: 'admittedBy', label: 'Admitted by' },
  { key: 'dischargedBy', label: 'Discharged by' },
]
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Bed {{ bed.bedNumber }} — {{ bed.wardName ?? '—' }}</h1>
    </template>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="theme-panel rounded-lg p-6 space-y-3">
        <h2 class="text-base font-medium">Details</h2>
        <div><span class="text-sand-11 text-sm">Status:</span> <span class="capitalize">{{ bed.status }}</span></div>
        <div><span class="text-sand-11 text-sm">Ward:</span> {{ bed.wardName ?? '—' }} ({{ bed.wing ?? '—' }})</div>
        <div><span class="text-sand-11 text-sm">Patient:</span> {{ bed.patient?.fullName ?? bed.patientName ?? '—' }}</div>
        <div><span class="text-sand-11 text-sm">Admitted:</span> {{ bed.admittedAt ?? '—' }}</div>
        <div v-if="bed.notes" class="whitespace-pre-line"><span class="text-sand-11 text-sm">Notes:</span> {{ bed.notes }}</div>
        <div class="flex gap-2 pt-2">
          <Link :href="`/beds/${bed.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
          <button
            v-if="bed.status === 'occupied'"
            type="button"
            class="rounded border border-red-300 px-4 py-2 text-sm text-red-700"
            @click="discharge"
          >
            Discharge
          </button>
          <Link href="/beds" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
        </div>
      </div>

      <div class="space-y-6">
        <form class="theme-panel rounded-lg p-6 space-y-3" @submit.prevent="submitStatus">
          <h2 class="text-base font-medium">Change status</h2>
          <select v-model="statusForm.status" class="w-full rounded border border-sand-6 px-3 py-2 capitalize">
            <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
          </select>
          <input
            v-if="statusForm.status === 'occupied'"
            v-model="statusForm.patient_name"
            type="text"
            placeholder="Patient name"
            class="theme-field w-full rounded px-3 py-2"
          />
          <p v-if="statusForm.errors.status" class="text-sm text-red-600">{{ statusForm.errors.status }}</p>
          <ActionButton type="submit" variant="blue" :loading="statusForm.processing" loading-text="Saving…">Update status</ActionButton>
        </form>

        <form class="theme-panel rounded-lg p-6 space-y-3" @submit.prevent="submitMove">
          <h2 class="text-base font-medium">Move bed</h2>
          <select v-model="moveForm.ward_id" class="theme-field w-full rounded px-3 py-2">
            <optgroup v-for="w in allWardsWithBeds" :key="w.id" :label="`${w.name} (${w.wing})`">
              <option :value="w.id">{{ w.name }}</option>
            </optgroup>
          </select>
          <input v-model="moveForm.bed_number" type="text" placeholder="New bed number (optional)" class="theme-field w-full rounded px-3 py-2" />
          <input v-model="moveForm.reason" type="text" placeholder="Reason (optional)" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="moveForm.errors.ward_id" class="text-sm text-red-600">{{ moveForm.errors.ward_id }}</p>
          <p v-if="moveForm.errors.bed_number" class="text-sm text-red-600">{{ moveForm.errors.bed_number }}</p>
          <ActionButton type="submit" variant="outline" :loading="moveForm.processing" loading-text="Submitting…">Move</ActionButton>
        </form>
      </div>
    </div>

    <div class="mt-6">
      <h2 class="mb-2 text-base font-medium">Accessories on this bed</h2>
      <DataTable
        :columns="[{ key: 'type', label: 'Type' }, { key: 'name', label: 'Name' }, { key: 'assetTag', label: 'Asset tag' }, { key: 'status', label: 'Status' }]"
        :rows="bed.accessories"
        :searchable="false"
        empty-text="No accessories attached."
      >
        <template #cell:name="{ row }">{{ row.name ?? '—' }}</template>
        <template #cell:assetTag="{ row }">{{ row.assetTag ?? '—' }}</template>
      </DataTable>
    </div>

    <div class="mt-6">
      <h2 class="mb-2 text-base font-medium">Assignment history</h2>
      <DataTable :columns="assignmentColumns" :rows="bed.assignments" :searchable="false" empty-text="No assignment history.">
        <template #cell:patientName="{ row }">{{ row.patientName ?? '—' }}</template>
        <template #cell:dischargedAt="{ row }">{{ row.dischargedAt ?? '—' }}</template>
        <template #cell:admittedBy="{ row }">{{ row.admittedBy ?? '—' }}</template>
        <template #cell:dischargedBy="{ row }">{{ row.dischargedBy ?? '—' }}</template>
      </DataTable>
    </div>
  </StaffLayout>
</template>
