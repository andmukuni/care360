<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

interface Transaction {
  id: number
  provider: string
  reference: string
  gatewayReference: string | null
  operator: string | null
  phone: string | null
  amount: number
  currency: string
  status: string
  failureReason: string | null
  lastCheckedAt: string | null
  createdAt: string | null
  patientName: string
  patientNumber: string | null
  invoiceNumber: string | null
}

const props = defineProps<{
  statuses: string[]
  status: string
  transactions: Transaction[]
}>()

const columns = [
  { key: 'reference', label: 'Reference' },
  { key: 'patientName', label: 'Patient' },
  { key: 'invoiceNumber', label: 'Invoice' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
]

const openStatuses = ['pending', 'otp-required', 'pay-offline']

function filterStatus(value: string) {
  router.get('/payment-transactions', value ? { status: value } : {}, { preserveState: false })
}

function checkStatus(t: Transaction) {
  router.post(`/payment-transactions/${t.id}/check`, {}, { preserveScroll: true })
}

function retry(t: Transaction) {
  router.post(`/payment-transactions/${t.id}/retry`, {}, { preserveScroll: true })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Payment Transactions</h1></template>

    <div class="mb-4 flex flex-wrap gap-2 text-sm">
      <button
        type="button"
        class="rounded border border-sand-6 px-3 py-1.5"
        :class="!props.status ? 'bg-blue-600 text-white' : ''"
        @click="filterStatus('')"
      >
        All
      </button>
      <button
        v-for="s in props.statuses"
        :key="s"
        type="button"
        class="rounded border border-sand-6 px-3 py-1.5"
        :class="props.status === s ? 'bg-blue-600 text-white' : ''"
        @click="filterStatus(s)"
      >
        {{ s }}
      </button>
    </div>

    <DataTable :columns="columns" :rows="props.transactions" :search-keys="['reference', 'patientName', 'invoiceNumber', 'phone']">
      <template #cell:amount="{ row }">{{ row.currency }} {{ row.amount.toFixed(2) }}</template>
      <template #cell:status="{ row }">
        <span class="capitalize">{{ row.status }}</span>
        <div v-if="row.failureReason" class="text-xs text-red-600">{{ row.failureReason }}</div>
      </template>
      <template #actions="{ row }">
        <button
          v-if="openStatuses.includes(row.status)"
          type="button"
          class="text-blue-600 hover:underline"
          @click="checkStatus(row)"
        >
          Check status
        </button>
        <button
          v-if="row.status === 'failed'"
          type="button"
          class="ml-3 text-amber-700 hover:underline"
          @click="retry(row)"
        >
          Retry
        </button>
      </template>
    </DataTable>
  </StaffLayout>
</template>
