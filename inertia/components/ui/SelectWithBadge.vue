<script setup lang="ts">
import { computed } from 'vue'
import type { VitalBadge } from '~/support/vital_badges'
import { severityFromBadge } from '~/support/vital_badges'

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    badge?: VitalBadge | null
    options: { value: string; label: string }[]
    disabled?: boolean
    selectClass?: string
  }>(),
  {
    badge: null,
    disabled: false,
    selectClass: '',
  }
)

const fieldClass = computed(() => {
  const severity = severityFromBadge(props.badge)
  if (!severity || severity === 'normal') return ''
  return `field-input--vital-${severity}`
})
</script>

<template>
  <div class="relative">
    <select
      v-model="model"
      :disabled="disabled"
      class="field-input"
      :class="[badge ? 'pr-28' : '', fieldClass, selectClass]"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <span
      v-if="badge"
      class="pointer-events-none absolute right-7 top-1/2 max-w-[42%] -translate-y-1/2 truncate rounded-full px-2 py-0.5 text-[10px] font-bold"
      :style="{ background: badge.bg, color: badge.color }"
      :title="badge.label"
    >
      {{ badge.label }}
    </span>
  </div>
</template>
