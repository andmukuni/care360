<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

defineProps<{
  label: string
  count: number
  href: string
  actionLabel: string
  dotClass: string
  titleClass: string
}>()
</script>

<template>
  <Link
    :href="href"
    class="theme-surface group flex min-h-[7.5rem] flex-col rounded-2xl p-4 transition-colors hover:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:hover:border-white/[0.08]"
  >
    <div class="mb-3 flex min-w-0 items-center gap-2">
      <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full" :class="dotClass" />
      <span class="truncate text-sm font-semibold leading-tight" :class="titleClass">
        {{ label }}
      </span>
    </div>

    <p class="text-3xl font-bold leading-none tabular-nums tracking-tight text-neutral-900 dark:text-white">
      {{ count.toLocaleString() }}
    </p>

    <p class="mt-auto pt-3 text-xs text-neutral-400 transition-colors group-hover:text-neutral-600 dark:group-hover:text-neutral-300">
      {{ actionLabel }} →
    </p>
  </Link>
</template>
