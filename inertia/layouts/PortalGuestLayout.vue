<script setup lang="ts">
import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import ThemeToggle from '~/components/ui/ThemeToggle.vue'

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)
</script>

<template>
  <div class="portal-shell flex min-h-screen items-center justify-center bg-sand-2 p-4 dark:bg-neutral-950">
    <div class="absolute right-4 top-4">
      <ThemeToggle />
    </div>
    <div
      class="modal-panel w-full max-w-md rounded-lg p-6 shadow-lg"
    >
      <div class="mb-6 text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ clinicName }}</div>
      <slot />
    </div>
  </div>
</template>
