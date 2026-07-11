<script setup lang="ts">
defineProps<{
  appointmentType: string
  appointmentPurpose?: string | null
  createdAtRelative?: string | null
  reason?: string | null
}>()
</script>

<template>
  <div>
    <div class="queue-cell-inline queue-cell-inline--nowrap">
      <span class="queue-cell-main">{{ appointmentType }}</span>
      <span v-if="appointmentPurpose" class="queue-chip queue-chip--info">{{ appointmentPurpose }}</span>
      <template v-if="createdAtRelative">
        <span class="queue-cell-sep" aria-hidden="true">·</span>
        <span class="queue-cell-sub">Requested {{ createdAtRelative }}</span>
      </template>
    </div>
    <p v-if="reason" class="mt-0.5 max-w-[280px] truncate text-xs text-neutral-400">
      {{ reason }}
    </p>
  </div>
</template>
