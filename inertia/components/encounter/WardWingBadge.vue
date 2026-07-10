<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  wing: string | null
}>()

const wingKey = computed(() => String(props.wing ?? '').toLowerCase())

const badgeClasses = computed(() => {
  if (wingKey.value === 'male') {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800'
  }
  if (wingKey.value === 'female') {
    return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-800'
  }
  return 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
})

const label = computed(() => {
  if (!props.wing) return ''
  return `${props.wing.charAt(0).toUpperCase()}${props.wing.slice(1)} Wing`
})
</script>

<template>
  <span
    v-if="wing"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
    :class="badgeClasses"
    :title="label"
    :aria-label="label"
    role="img"
  >
    <svg
      v-if="wingKey === 'male'"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="10" cy="14" r="5" />
      <path stroke-linecap="round" d="M15 9l5-5M20 4h-4M20 4v4" />
    </svg>
    <svg
      v-else-if="wingKey === 'female'"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="5" />
      <path stroke-linecap="round" d="M12 14v7M9 18h6" />
    </svg>
    <svg
      v-else
      class="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
      />
    </svg>
  </span>
</template>
