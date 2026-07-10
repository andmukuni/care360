<script setup lang="ts">
import type { QueueTab } from '~/composables/useStageQueue'

defineProps<{
  tab: QueueTab
  queuedTotal: number
  inProgressTotal: number
  partiallyDispensedTotal?: number
  closedTotal?: number
  waitingLabel?: string
  progressLabel?: string
  partiallyDispensedLabel?: string
  closedLabel?: string
  theme?: 'default' | 'treatment'
}>()

const emit = defineEmits<{
  'update:tab': [value: QueueTab]
}>()
</script>

<template>
  <div
    class="queue-segments"
    :class="theme === 'treatment' ? 'queue-segments--treatment' : ''"
    role="tablist"
    aria-label="Queue views"
  >
    <button
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'waiting' }"
      :aria-selected="tab === 'waiting'"
      @click="emit('update:tab', 'waiting')"
    >
      <span>{{ waitingLabel ?? 'Waiting' }}</span>
      <span class="queue-segment-count">{{ queuedTotal }}</span>
    </button>
    <button
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'progress' }"
      :aria-selected="tab === 'progress'"
      @click="emit('update:tab', 'progress')"
    >
      <span>{{ progressLabel ?? 'In progress' }}</span>
      <span class="queue-segment-count">{{ inProgressTotal }}</span>
    </button>
    <button
      v-if="partiallyDispensedTotal !== undefined"
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'partially_dispensed' }"
      :aria-selected="tab === 'partially_dispensed'"
      @click="emit('update:tab', 'partially_dispensed')"
    >
      <span>{{ partiallyDispensedLabel ?? 'Partially dispensed' }}</span>
      <span class="queue-segment-count">{{ partiallyDispensedTotal }}</span>
    </button>
    <button
      v-if="closedTotal !== undefined"
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'closed' }"
      :aria-selected="tab === 'closed'"
      @click="emit('update:tab', 'closed')"
    >
      <span>{{ closedLabel ?? 'Closed' }}</span>
      <span class="queue-segment-count">{{ closedTotal }}</span>
    </button>
  </div>
</template>
