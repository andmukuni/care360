<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import HouseholdIdCard from '~/components/households/HouseholdIdCard.vue'

defineProps<{
  households: {
    householdId: string
    headOfHouseName: string
    barcode: string
    village: string
    town: string
    nrcNumber?: string
    phoneNumber?: string
  }[]
  search: string
}>()

function print() {
  window.print()
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Household ID Cards</h1></template>

    <div class="mb-4 flex items-center justify-between print:hidden">
      <Link href="/households" class="text-sm text-blue-600 hover:underline">← Back to households</Link>
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="print">Print All</button>
    </div>

    <div class="household-id-cards-grid">
      <HouseholdIdCard
        v-for="h in households"
        :key="h.householdId"
        :printable-id="`household-id-card-${h.householdId}`"
        :head-name="h.headOfHouseName"
        :village="h.village"
        :town="h.town"
        :nrc="h.nrcNumber"
        :phone="h.phoneNumber"
        :barcode="h.barcode || h.householdId"
        class="household-id-cards-grid__item"
      />
    </div>
    <p v-if="!households.length" class="text-sm text-sand-11 print:hidden">No households found.</p>
  </StaffLayout>
</template>

<style scoped>
.household-id-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(284px, 1fr));
  gap: 16px;
  justify-items: center;
}

@media print {
  .household-id-cards-grid {
    display: block;
  }

  .household-id-cards-grid__item {
    page-break-inside: avoid;
    margin: 0 auto 8mm;
  }
}
</style>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }

  .household-id-cards-grid,
  .household-id-cards-grid *,
  .household-id-card-preview,
  .household-id-card-preview *,
  [id^='household-id-card-'],
  [id^='household-id-card-'] * {
    visibility: visible !important;
  }

  .household-id-cards-grid {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

  [id^='household-id-card-'] {
    position: relative;
    margin: 0 auto 24px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    page-break-inside: avoid;
  }

  .household-id-card-preview {
    width: 591px;
    height: 889px;
    transform: none;
  }

  .household-id-card-preview .household-id-card {
    transform: none;
  }

  [id^='household-id-card-'] .household-id-card__header {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>
