<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

defineProps<{
  href: string
  label?: string
}>()
</script>

<template>
  <Link
    :href="href"
    class="queue-btn border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
  >
    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
    <span>{{ label ?? 'Queue' }}</span>
  </Link>
</template>
