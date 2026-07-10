<script setup lang="ts">
import PortalGuestLayout from '~/layouts/PortalGuestLayout.vue'

defineProps<{
  fundName: string
}>()
</script>

<template>
  <PortalGuestLayout>
    <div class="text-center py-6">
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">Thank you</h1>
      <p class="text-neutral-600 dark:text-neutral-400 leading-relaxed">
        Your corporate {{ fundName }} inquiry has been received. Our partnerships team will contact
        you to complete KYC and sign the formal agreement.
      </p>
      <a
        href="/wellness-fund/corporate"
        class="inline-block mt-8 text-teal-700 dark:text-teal-400 font-semibold"
      >
        Back to corporate partnership page
      </a>
    </div>
  </PortalGuestLayout>
</template>
