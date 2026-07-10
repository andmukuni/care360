<script setup lang="ts">
withDefaults(
  defineProps<{
    hint?: string
  }>(),
  {
    hint: 'Optional',
  }
)
</script>

<template>
  <span class="field-optional-mark" :title="hint" aria-label="Optional" role="img">
    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  </span>
</template>
