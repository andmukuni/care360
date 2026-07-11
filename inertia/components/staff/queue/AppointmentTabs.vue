<script setup lang="ts">
export type AppointmentTab = 'pending' | 'confirmed' | 'today'

defineProps<{
  tab: AppointmentTab
  pendingCount: number
  confirmedCount: number
  todayCount: number
}>()

const emit = defineEmits<{
  'update:tab': [value: AppointmentTab]
}>()
</script>

<template>
  <div class="queue-segments" role="tablist" aria-label="Appointment views">
    <button
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'pending' }"
      :aria-selected="tab === 'pending'"
      @click="emit('update:tab', 'pending')"
    >
      <span>Pending</span>
      <span class="queue-segment-count">{{ pendingCount }}</span>
    </button>
    <button
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'confirmed' }"
      :aria-selected="tab === 'confirmed'"
      @click="emit('update:tab', 'confirmed')"
    >
      <span>Confirmed</span>
      <span class="queue-segment-count">{{ confirmedCount }}</span>
    </button>
    <button
      type="button"
      role="tab"
      class="queue-segment"
      :class="{ active: tab === 'today' }"
      :aria-selected="tab === 'today'"
      @click="emit('update:tab', 'today')"
    >
      <span>Today</span>
      <span class="queue-segment-count">{{ todayCount }}</span>
    </button>
  </div>
</template>
