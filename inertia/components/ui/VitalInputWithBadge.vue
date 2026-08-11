<script setup lang="ts">
import { computed } from 'vue'
import type { VitalBadge } from '~/support/vital_badges'
import { severityFromBadge } from '~/support/vital_badges'
import {
  HINT_DECIMALS_ALLOWED,
  HINT_WHOLE_NUMBERS,
  resolvesHtmlInputType,
  resolvesInputMode,
  resolvesNumericStep,
  sanitizeDecimalInput,
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

const htmlInputType = computed(() =>
  resolvesHtmlInputType(props.inputType, props.allowDecimals)
)

const usesDecimalTextInput = computed(
  () => props.inputType === 'number' && props.allowDecimals
)

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  let next = el.value
  if (usesDecimalTextInput.value) {
    next = sanitizeDecimalInput(next)
    if (el.value !== next) {
      el.value = next
    }
  }
  model.value = next === '' ? null : next
}
</script>

<template>
  <div>
    <div class="relative">
      <input
        :value="model == null ? '' : String(model)"
        :type="htmlInputType"
        :min="usesDecimalTextInput ? undefined : min"
        :max="usesDecimalTextInput ? undefined : max"
        :step="usesDecimalTextInput ? undefined : resolvedStep"
        :inputmode="inputMode"
        :placeholder="placeholder"
        :readonly="readonly"
        class="field-input"
        :class="[badge ? 'pr-28' : '', vitalFieldClass, inputClass]"
        @input="onInput"
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
