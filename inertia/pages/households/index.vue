<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'

interface HouseholdRow {
  householdId: string
  headOfHouseName: string
  phoneNumber: string
  village: string
  town: string
  barcode: string
  paymentStatus: string
  headExtractionStatus?: string
  headExtractionLabel?: string
}

defineProps<{
  households: HouseholdRow[]
  total: number
  search: string
}>()

const columns = [
  { key: 'householdId', label: 'Household ID' },
  { key: 'headOfHouseName', label: 'Head of House' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'village', label: 'Village' },
  { key: 'paymentStatus', label: 'Payment' },
  { key: 'headExtractionLabel', label: 'Head Extraction' },
]

function extractAll() {
  if (confirm('Extract head-of-house patients for all households? This runs synchronously.')) {
    router.post('/households/extract-head-patients', {}, { preserveScroll: true })
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Households</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-sand-11">{{ total }} households</p>
      <div class="flex gap-2">
        <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm" @click="extractAll">
          Extract Heads
        </button>
        <Link href="/households/barcodes/print" class="theme-icon-btn rounded px-3 py-1.5 text-sm">
          Print Barcodes
        </Link>
        <Link href="/households/create" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">New Household</Link>
      </div>
    </div>

    <DataTable :columns="columns" :rows="households" :search-keys="['householdId', 'headOfHouseName', 'phoneNumber', 'village', 'barcode']">
      <template #cell:householdId="{ row }">
        <Link :href="`/households/${row.householdId}`" class="font-mono text-blue-600 hover:underline">{{ row.householdId }}</Link>
      </template>
      <template #cell:phoneNumber="{ row }">{{ row.phoneNumber || '—' }}</template>
      <template #cell:village="{ row }">{{ row.village || '—' }}</template>
      <template #cell:headExtractionLabel="{ row }">
        <span
          class="rounded px-2 py-0.5 text-xs"
          :class="{
            'bg-green-100 text-green-800': row.headExtractionStatus === 'extracted',
            'bg-amber-100 text-amber-800': row.headExtractionStatus === 'pending',
            'bg-red-100 text-red-800': row.headExtractionStatus === 'missing',
          }"
        >{{ row.headExtractionLabel }}</span>
      </template>
      <template #actions="{ row }">
        <Link :href="`/households/${row.householdId}`" class="text-blue-600 hover:underline">View</Link>
      </template>
    </DataTable>
  </StaffLayout>
</template>
