<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    value: string | number
    meta?: string
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo'
  }>(),
  {
    color: 'blue',
    meta: '',
  }
)

const palette = computed(() => {
  const map = {
    green: {
      circle: 'bg-cyan-500',
      title: 'text-cyan-600 dark:text-cyan-400',
    },
    yellow: {
      circle: 'bg-orange-500',
      title: 'text-orange-500 dark:text-orange-400',
    },
    red: {
      circle: 'bg-red-500',
      title: 'text-red-600 dark:text-red-400',
    },
    purple: {
      circle: 'bg-purple-600',
      title: 'text-purple-600 dark:text-purple-400',
    },
    indigo: {
      circle: 'bg-purple-600',
      title: 'text-purple-600 dark:text-purple-400',
    },
    blue: {
      circle: 'bg-teal-700',
      title: 'text-teal-700 dark:text-teal-400',
    },
  }
  return map[props.color]
})
</script>

<template>
  <div class="stat-dash-card theme-surface rounded-2xl p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2.5">
        <div
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white [&>svg]:block [&>svg]:h-4 [&>svg]:w-4"
          :class="palette.circle"
        >
          <slot name="icon" />
        </div>
        <span class="truncate text-sm font-semibold" :class="palette.title">
          {{ title }}
        </span>
      </div>

      <button
        v-if="meta"
        type="button"
        class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
        :title="meta"
        aria-label="More information"
      >
        ?
      </button>
    </div>

    <p class="text-3xl font-bold leading-none tabular-nums tracking-tight text-neutral-900 dark:text-white">
      {{ value }}
    </p>

    <p v-if="meta" class="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
      {{ meta }}
    </p>
  </div>
</template>
