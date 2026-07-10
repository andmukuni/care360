<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

const typeStyles: Record<string, string> = {
  success:
    'border-emerald-200 bg-white text-emerald-900 shadow-emerald-100/80 dark:border-emerald-800 dark:bg-neutral-900 dark:text-emerald-100',
  error:
    'border-red-200 bg-white text-red-900 shadow-red-100/80 dark:border-red-800 dark:bg-neutral-900 dark:text-red-100',
  info: 'border-blue-200 bg-white text-blue-900 shadow-blue-100/80 dark:border-blue-800 dark:bg-neutral-900 dark:text-blue-100',
  warning:
    'border-amber-200 bg-white text-amber-900 shadow-amber-100/80 dark:border-amber-800 dark:bg-neutral-900 dark:text-amber-100',
}

const iconPaths: Record<string, string> = {
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
}

const iconColors: Record<string, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-4 top-4 z-[10050] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4"
      aria-live="polite"
      aria-relevant="additions"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-4 opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-4 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg"
          :class="typeStyles[toast.type]"
          role="status"
        >
          <svg
            class="mt-0.5 h-5 w-5 shrink-0"
            :class="iconColors[toast.type]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPaths[toast.type]" />
          </svg>
          <p class="min-w-0 flex-1 text-sm font-medium leading-snug">{{ toast.message }}</p>
          <button
            type="button"
            class="shrink-0 rounded p-0.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
