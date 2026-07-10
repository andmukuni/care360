<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'

interface Registration {
  id: number
  patientNumber: string
  fullName: string
  email: string | null
  phoneNumber: string | null
  gender: string | null
  status: string
  updatedAt: string | null
}

defineProps<{ registrations: Registration[] }>()

const { processingId, runFor } = useAsyncAction<string>()

const columns = [
  { key: 'fullName', label: 'Name' },
  { key: 'patientNumber', label: 'Patient ID' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'updatedAt', label: 'Signed up' },
]

function approve(r: Registration) {
  if (!confirm(`Approve portal access for ${r.fullName}?`)) return
  runFor(`${r.id}-approve`, ({ done }) => {
    router.post(`/portal-registrations/${r.id}/approve`, {}, { onFinish: done })
  })
}

function decline(r: Registration) {
  if (!confirm(`Decline ${r.fullName}’s portal sign-up? Their portal password will be cleared.`)) return
  runFor(`${r.id}-decline`, ({ done }) => {
    router.post(`/portal-registrations/${r.id}/decline`, {}, { onFinish: done })
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Portal Registrations</h1></template>

    <p class="mb-4 text-sm text-sand-11">
      Patients who self-registered via the mobile app and are awaiting staff approval.
    </p>

    <DataTable :columns="columns" :rows="registrations">
      <template #cell:email="{ row }">{{ row.email ?? '—' }}</template>
      <template #cell:phoneNumber="{ row }">{{ row.phoneNumber ?? '—' }}</template>
      <template #actions="{ row }">
        <ActionButton
          variant="green"
          class="!bg-transparent !px-0 !py-0 text-green-700 hover:underline"
          :loading="processingId === `${row.id}-approve`"
          loading-text="Approving…"
          @click="approve(row)"
        >
          Approve
        </ActionButton>
        <ActionButton
          variant="danger"
          class="ml-3 !bg-transparent !px-0 !py-0 text-red-600 hover:underline"
          :loading="processingId === `${row.id}-decline`"
          loading-text="Declining…"
          @click="decline(row)"
        >
          Decline
        </ActionButton>
      </template>
    </DataTable>
  </StaffLayout>
</template>
