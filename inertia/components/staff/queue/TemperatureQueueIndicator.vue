<script setup lang="ts">
import { computed } from 'vue'
import { temperatureBadge } from '~/support/vital_badges'

const props = withDefaults(
  defineProps<{
    temperature: number | string | null | undefined
    hideWhenMissing?: boolean
  }>(),
  {
    hideWhenMissing: false,
  }
)

const badge = computed(() => temperatureBadge(props.temperature))

const formattedTemp = computed(() => {
  const value = Number(props.temperature)
  if (!Number.isFinite(value)) {
    return null
  }
  return `${value.toFixed(1)}°C`
})
</script>

<template>
  <div v-if="badge" class="queue-temp-indicator">
    <span
      class="queue-temp-indicator-chip"
      :style="{ background: badge.bg, color: badge.color }"
    >
      {{ badge.label }}
    </span>
    <span class="queue-temp-indicator-value">{{ formattedTemp }}</span>
  </div>
  <span v-else-if="!hideWhenMissing" class="queue-cell-sub">No temperature recorded</span>
</template>
