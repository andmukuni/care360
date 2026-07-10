<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

defineProps<{ error: any }>()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
    <div class="theme-surface max-w-md rounded-xl p-8 text-center">
      <p class="text-6xl font-bold text-neutral-300 dark:text-neutral-600">500</p>
      <h1 class="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Server error</h1>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{{ error.message }}</p>
      <Link
        href="/"
        class="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800"
      >
        Go home
      </Link>
    </div>
  </div>
</template>
