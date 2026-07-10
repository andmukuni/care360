<script setup lang="ts">
import { computed } from 'vue'
import Spinner from '~/components/ui/Spinner.vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    loadingText?: string
    disabled?: boolean
    type?: 'button' | 'submit'
    variant?: 'primary' | 'secondary' | 'danger' | 'queue' | 'queue-treatment' | 'blue' | 'green' | 'outline'
    class?: string
  }>(),
  {
    loading: false,
    loadingText: 'Processing…',
    disabled: false,
    type: 'button',
    variant: 'primary',
  }
)

const isDisabled = computed(() => props.loading || props.disabled)

const variantClass = computed(() => {
  switch (props.variant) {
    case 'queue':
      return 'queue-btn queue-btn--primary'
    case 'queue-treatment':
      return 'queue-btn queue-btn--primary queue-btn--treatment'
    case 'secondary':
      return 'btn-secondary'
    case 'danger':
      return 'action-btn action-btn--danger'
    case 'blue':
      return 'action-btn action-btn--blue'
    case 'green':
      return 'action-btn action-btn--green'
    case 'outline':
      return 'action-btn action-btn--outline'
    default:
      return 'btn-primary'
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading"
    :class="[variantClass, 'inline-flex items-center justify-center gap-2', props.class]"
  >
    <template v-if="loading">
      <Spinner />
      <span>{{ loadingText }}</span>
    </template>
    <template v-else>
      <slot name="icon" />
      <slot />
    </template>
  </button>
</template>
