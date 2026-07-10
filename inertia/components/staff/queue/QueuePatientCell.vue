<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  patientName: string | null
  visitType?: string | null
  details?: string | null
  subtitle?: string | null
  visitFallback?: string
  nameFallback?: string
}>()

const secondary = computed(() => {
  if (props.subtitle?.trim()) {
    return props.subtitle.trim()
  }

  const parts = [
    props.visitType?.trim() || props.visitFallback || '',
    props.details?.trim() || '',
  ].filter(Boolean)

  return parts.join(' · ')
})
</script>

<template>
  <div v-if="secondary" class="queue-cell-inline">
    <span class="queue-cell-main">{{ patientName ?? nameFallback ?? '—' }}</span>
    <span class="queue-cell-sep" aria-hidden="true">·</span>
    <span class="queue-cell-sub">{{ secondary }}</span>
  </div>
  <div v-else class="queue-cell-main">{{ patientName ?? nameFallback ?? '—' }}</div>
</template>
