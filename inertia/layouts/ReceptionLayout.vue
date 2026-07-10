<script setup lang="ts">
import ThemeToggle from '~/components/ui/ThemeToggle.vue'
</script>

<template>
  <div class="reception-shell min-h-screen bg-sand-1 text-sand-12 dark:bg-neutral-950 dark:text-neutral-100">
    <header class="flex h-16 items-center justify-between bg-primary px-6 font-semibold text-white">
      <span>Reception</span>
      <ThemeToggle />
    </header>
    <main class="p-6">
      <slot />
    </main>
  </div>
</template>
