<script setup lang="ts">
defineProps<{
  theme?: 'default' | 'treatment'
}>()
</script>

<template>
  <div
    class="queue-table-wrap"
    :class="theme === 'treatment' ? 'queue-table-wrap--treatment' : ''"
  >
    <table class="queue-table">
      <thead>
        <slot name="head" />
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>
