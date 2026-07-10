<script setup lang="ts">
import VitalInputWithBadge from '~/components/ui/VitalInputWithBadge.vue'
import type { VitalBadge } from '~/support/vital_badges'

withDefaults(
  defineProps<{
    badge?: VitalBadge | null
    disabled?: boolean
    inputType?: string
    inputClass?: string
    placeholder?: string
    step?: string | number
  }>(),
  {
    badge: null,
    disabled: false,
    inputType: 'text',
    inputClass: 'text-xs',
    placeholder: '',
    step: undefined,
  }
)

const model = defineModel<string>({ required: true })
</script>

<template>
  <VitalInputWithBadge
    v-model="model"
    :input-type="inputType"
    :step="step"
    :input-class="inputClass"
    :readonly="disabled"
    :badge="badge"
    :placeholder="placeholder"
  />
</template>
