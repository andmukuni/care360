<script setup lang="ts">
import { computed } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  invoice: Record<string, any>
}>()

const amount = computed(
  () => 'K ' + Number(props.invoice.balance_due).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
)

function confirmPayment() {
  router.post(`/portal/memberships/sandbox/${props.invoice.id}/confirm`)
}
</script>

<template>
  <PortalLayout>
    <div class="max-w-md mx-auto">
      <div class="rounded-xl theme-surface p-6 text-center">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Sandbox gateway · test mode</p>
        <h1 class="text-xl font-bold mt-1">Confirm payment</h1>
        <p class="text-sm text-neutral-500 mt-2">{{ invoice.invoice_number }}</p>
        <p class="text-3xl font-bold mt-4">{{ amount }}</p>

        <p class="text-xs text-neutral-400 mt-4">
          This is a simulated gateway for testing. In production this page is replaced by your real
          payment provider's checkout. No real money moves.
        </p>

        <button type="button" @click="confirmPayment" class="mt-6 w-full px-4 py-2.5 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
          Pay {{ amount }} now
        </button>
        <Link href="/portal/memberships" class="block mt-3 text-xs font-semibold text-neutral-500 hover:underline">Cancel and go back</Link>
      </div>
    </div>
  </PortalLayout>
</template>
