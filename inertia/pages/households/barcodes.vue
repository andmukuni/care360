<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

defineProps<{
  households: { householdId: string; headOfHouseName: string; barcode: string; village: string; town: string }[]
  search: string
}>()

function print() {
  window.print()
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Household Barcodes</h1></template>

    <div class="mb-4 flex items-center justify-between print:hidden">
      <Link href="/households" class="text-sm text-blue-600 hover:underline">← Back to households</Link>
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="print">Print</button>
    </div>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
      <div
        v-for="h in households"
        :key="h.householdId"
        class="theme-panel rounded-lg p-4 text-center"
      >
        <p class="text-sm font-medium">{{ h.headOfHouseName }}</p>
        <p class="text-xs text-sand-11">{{ [h.village, h.town].filter(Boolean).join(', ') || '—' }}</p>
        <p class="mt-2 font-mono text-lg tracking-widest">{{ h.barcode || h.householdId }}</p>
        <p class="text-xs text-sand-11">{{ h.householdId }}</p>
      </div>
    </div>
    <p v-if="!households.length" class="text-sm text-sand-11">No households found.</p>
  </StaffLayout>
</template>
