<script setup lang="ts">
import type { AutosaveStatus } from '~/composables/useAutosave'

defineProps<{
  status: AutosaveStatus
  text: string
}>()
</script>

<template>
  <span
    v-if="text"
    class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
    :class="{
      'border-sand-6 bg-sand-2 text-sand-11 dark:text-neutral-300': status === 'idle' || status === 'pending',
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300': status === 'saving',
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300': status === 'saved',
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300': status === 'error',
    }"
    role="status"
    aria-live="polite"
  >
    {{ text }}
  </span>
</template>
