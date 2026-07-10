<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import HouseholdMembers from '~/components/staff/households/HouseholdMembers.vue'

const props = defineProps<{
  household: Record<string, any>
  members: any[]
  membersTotal: number
}>()

function extractHead() {
  router.post(`/households/${props.household.householdId}/extract-head-patient`, {}, { preserveScroll: true })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Household — {{ household.headOfHouseName }}</h1></template>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="font-mono text-sm text-sand-11">{{ household.householdId }}</span>
      <span class="rounded bg-sand-3 px-2 py-0.5 text-xs text-sand-11">{{ household.paymentStatus }}</span>
      <div class="ml-auto flex gap-2">
        <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm" @click="extractHead">Extract Head</button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Details</h2>
        <dl class="space-y-3 text-sm">
          <div><dt class="text-sand-11">Head of House</dt><dd>{{ household.headOfHouseName }}</dd></div>
          <div><dt class="text-sand-11">Phone</dt><dd>{{ household.phoneNumber || '—' }}</dd></div>
          <div><dt class="text-sand-11">NRC</dt><dd>{{ household.nrcNumber || '—' }}</dd></div>
          <div><dt class="text-sand-11">Village</dt><dd>{{ household.village || '—' }}</dd></div>
          <div><dt class="text-sand-11">Town</dt><dd>{{ household.town || '—' }}</dd></div>
          <div><dt class="text-sand-11">Type</dt><dd>{{ household.householdType || '—' }}</dd></div>
          <div><dt class="text-sand-11">Barcode</dt><dd class="font-mono">{{ household.barcode || '—' }}</dd></div>
          <div><dt class="text-sand-11">Subscription Plan</dt><dd>{{ household.subscriptionPlan || '—' }}</dd></div>
          <div><dt class="text-sand-11">Subscription Fee</dt><dd>{{ household.subscriptionFee ?? '—' }}</dd></div>
          <div><dt class="text-sand-11">Payment Method</dt><dd>{{ household.paymentMethod || '—' }}</dd></div>
        </dl>
        <div class="mt-4 border-t border-sand-4 pt-4">
          <Link href="/households" class="text-sm text-blue-600 hover:underline">← Back to households</Link>
        </div>
      </section>

      <div class="lg:col-span-2">
        <HouseholdMembers :household-id="household.householdId" :members="members" />
      </div>
    </div>
  </StaffLayout>
</template>
