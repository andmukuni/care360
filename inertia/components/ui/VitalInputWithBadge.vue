<script setup lang="ts">
import { computed } from 'vue'
import type { VitalBadge } from '~/support/vital_badges'
import { severityFromBadge } from '~/support/vital_badges'
import {
  HINT_DECIMALS_ALLOWED,
  HINT_WHOLE_NUMBERS,
  resolvesInputMode,
  resolvesNumericStep,
} from '~/support/numeric_input'

const model = defineModel<number | string | null>({ required: true })

const props = withDefaults(
  defineProps<{
    badge?: VitalBadge | null
    inputType?: string
    min?: number | string
    max?: number | string
    step?: number | string
    allowDecimals?: boolean
    hint?: string | null
    placeholder?: string
    readonly?: boolean
    inputClass?: string
  }>(),
  {
    inputType: 'number',
    badge: null,
    readonly: false,
    inputClass: '',
    allowDecimals: true,
    hint: undefined,
  }
)

const vitalFieldClass = computed(() => {
  const severity = severityFromBadge(props.badge)
  if (!severity || severity === 'normal') return ''
  return `field-input--vital-${severity}`
})

const resolvedStep = computed(() =>
  resolvesNumericStep(props.inputType, props.step, props.allowDecimals)
)

const inputMode = computed(() =>
  resolvesInputMode(props.inputType, props.step, props.allowDecimals)
)

const fieldHint = computed(() => {
  if (props.hint !== undefined) {
    return props.hint
  }
  if (props.inputType !== 'number' || props.readonly) {
    return null
  }
  return props.allowDecimals ? HINT_DECIMALS_ALLOWED : HINT_WHOLE_NUMBERS
})
</script>

<template>
  <div>
    <div class="relative">
      <input
        v-model="model"
        :type="inputType"
        :min="min"
        :max="max"
        :step="resolvedStep"
        :inputmode="inputMode"
        :placeholder="placeholder"
        :readonly="readonly"
        class="field-input"
        :class="[badge ? 'pr-28' : '', vitalFieldClass, inputClass]"
      />
      <span
        v-if="badge"
        class="absolute right-2 top-1/2 max-w-[42%] -translate-y-1/2 truncate rounded-full px-2 py-0.5 text-[10px] font-bold"
        :style="{ background: badge.bg, color: badge.color }"
        :title="badge.label"
      >
        {{ badge.label }}
      </span>
    </div>
    <p v-if="fieldHint" class="mt-0.5 text-[10px] text-neutral-400">{{ fieldHint }}</p>
  </div>
</template>
