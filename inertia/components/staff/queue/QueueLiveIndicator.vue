<script setup lang="ts">
import { computed } from 'vue'
import { useStaffQueueLiveStatus } from '~/composables/useStaffQueueLiveStatus'

const { status } = useStaffQueueLiveStatus()

const label = computed(() => {
  switch (status.value) {
    case 'live':
      return 'Live'
    case 'connecting':
      return 'Connecting'
    case 'offline':
      return 'Offline'
  }
})

const title = computed(() => {
  switch (status.value) {
    case 'live':
      return 'Queue updates sync in real time across staff sessions'
    case 'connecting':
      return 'Connecting to live queue updates…'
    case 'offline':
      return 'Live updates unavailable — refresh the page to retry'
  }
})
</script>

<template>
  <span
    class="queue-live-indicator"
    :class="`queue-live-indicator--${status}`"
    :title="title"
    role="status"
    :aria-label="title"
  >
    <span class="queue-live-indicator-dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>
