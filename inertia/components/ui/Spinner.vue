<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md'
    class?: string
  }>(),
  {
    size: 'sm',
  }
)

const sizeClass = computed(() => {
  if (props.size === 'md') return 'h-5 w-5'
  if (props.size === 'xs') return 'h-[18px] w-[18px]'
  return 'h-4 w-4'
})
</script>

<template>
  <svg
    :class="[sizeClass, 'shrink-0 animate-spin', props.class]"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
</template>
