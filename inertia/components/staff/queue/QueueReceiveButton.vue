<script setup lang="ts">
import ActionButton from '~/components/ui/ActionButton.vue'

defineProps<{
  processing?: boolean
  disabled?: boolean
  label?: string
  theme?: 'default' | 'treatment'
}>()
</script>

<template>
  <ActionButton
    :loading="processing"
    loading-text="Processing…"
    :disabled="disabled"
    :variant="theme === 'treatment' ? 'queue-treatment' : 'queue'"
  >
    <template #icon>
      <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </template>
    {{ label ?? 'Receive' }}
  </ActionButton>
</template>
