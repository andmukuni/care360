<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface Lead {
  id: number
  companyName: string
  contactName: string
  jobTitle: string | null
  email: string
  phone: string | null
  registrationNumber: string | null
  employeesCount: number | null
  partnershipOption: string
  estimatedDepositOrVolume: number | null
  message: string | null
  status: string
  createdAt: string | null
}

defineProps<{ leads: Lead[] }>()

const columns = [
  { key: 'companyName', label: 'Company' },
  { key: 'contactName', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'partnershipOption', label: 'Option' },
  { key: 'status', label: 'Status' },
]

const detail = ref<Lead | null>(null)

function setStatus(lead: Lead, status: string) {
  router.post(`/corporate-leads/${lead.id}/status`, { status }, { preserveScroll: true })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Corporate Membership Leads</h1></template>

    <DataTable :columns="columns" :rows="leads">
      <template #cell:companyName="{ row }">
        <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.companyName }}</span>
      </template>
      <template #cell:status="{ row }">
        <select
          :value="row.status"
          class="rounded border border-sand-6 px-2 py-1 text-xs capitalize"
          @change="setStatus(row, ($event.target as HTMLSelectElement).value)"
        >
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="contacted">Contacted</option>
        </select>
      </template>
      <template #actions="{ row }">
        <div class="table-action-group">
          <TableIconButton variant="view" title="View lead details" @click="detail = row" />
        </div>
      </template>
    </DataTable>

    <div v-if="detail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg theme-panel rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div class="mb-3 flex items-start justify-between">
          <h2 class="text-base font-semibold">{{ detail.companyName }}</h2>
          <button type="button" class="text-sand-11" @click="detail = null">✕</button>
        </div>
        <dl class="space-y-2 text-sm">
          <div><dt class="text-sand-11">Contact</dt><dd>{{ detail.contactName }}<span v-if="detail.jobTitle"> — {{ detail.jobTitle }}</span></dd></div>
          <div><dt class="text-sand-11">Email</dt><dd>{{ detail.email }}</dd></div>
          <div><dt class="text-sand-11">Phone</dt><dd>{{ detail.phone ?? '—' }}</dd></div>
          <div><dt class="text-sand-11">Registration No.</dt><dd>{{ detail.registrationNumber ?? '—' }}</dd></div>
          <div><dt class="text-sand-11">Employees</dt><dd>{{ detail.employeesCount ?? '—' }}</dd></div>
          <div><dt class="text-sand-11">Partnership option</dt><dd>{{ detail.partnershipOption }}</dd></div>
          <div><dt class="text-sand-11">Estimated deposit / volume</dt><dd>{{ detail.estimatedDepositOrVolume ?? '—' }}</dd></div>
          <div><dt class="text-sand-11">Message</dt><dd class="whitespace-pre-line">{{ detail.message ?? '—' }}</dd></div>
        </dl>
        <div class="mt-4 flex justify-end">
          <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="detail = null">Close</button>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
