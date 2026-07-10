<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  segments: Array<string | number | null | undefined | false>
  emphasizeFirst?: boolean
}>()

const visible = computed(() =>
  props.segments.filter(
    (segment) => segment !== null && segment !== undefined && segment !== false && String(segment).trim() !== ''
  )
)
</script>

<template>
  <div v-if="visible.length" class="queue-cell-inline">
    <template v-for="(segment, index) in visible" :key="index">
      <span v-if="index > 0" class="queue-cell-sep" aria-hidden="true">·</span>
      <span
        :class="
          index === 0 && emphasizeFirst !== false
            ? 'queue-cell-main'
            : ['queue-cell-sub', emphasizeFirst === false ? 'font-medium text-neutral-700 dark:text-neutral-300' : '']
        "
      >
        {{ segment }}
      </span>
    </template>
  </div>
  <span v-else class="queue-cell-sub">—</span>
</template>
