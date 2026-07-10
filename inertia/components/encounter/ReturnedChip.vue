<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
  }>(),
  {
    title: 'Returned from a later stage for reassessment',
  }
)
</script>

<template>
  <span
    class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700"
    :title="title"
  >
    Returned
  </span>
</template>
