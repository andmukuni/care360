<script setup lang="ts">
defineProps<{
  label: string
  value?: string | null
}>()
</script>

<template>
  <div class="queue-meta-item">
    <dt class="queue-meta-label">{{ label }}</dt>
    <dd class="queue-meta-value">
      <slot>{{ value ?? '—' }}</slot>
    </dd>
  </div>
</template>
