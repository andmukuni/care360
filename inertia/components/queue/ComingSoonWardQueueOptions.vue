<script setup lang="ts">
const COMING_SOON_WARDS = [
  { id: 'mch', label: 'MCH', description: 'Mother & Child Health unit' },
  { id: 'art', label: 'ART', description: 'Antiretroviral therapy clinic' },
  { id: 'maternity', label: 'Maternity Ward', description: 'Inpatient maternity care' },
] as const
</script>

<template>
  <div
    v-for="ward in COMING_SOON_WARDS"
    :key="ward.id"
    class="coming-soon-ward theme-surface group flex w-full cursor-not-allowed items-center gap-4 rounded-lg px-4 py-3.5 opacity-60/50"
    aria-disabled="true"
  >
    <span
      class="coming-soon-ward__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-500 transition-transform duration-200 ease-out group-hover:scale-105 dark:bg-neutral-700 dark:text-neutral-400"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span
          class="block text-sm font-semibold text-neutral-700 transition-colors duration-200 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-neutral-100"
        >
          {{ ward.label }}
        </span>
        <span
          class="coming-soon-ward__badge rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 transition-all duration-200 dark:bg-neutral-700 dark:text-neutral-300"
        >
          Coming soon
        </span>
      </span>
      <span
        class="block text-xs text-neutral-500 transition-colors duration-200 group-hover:text-neutral-600 dark:group-hover:text-neutral-400"
      >
        {{ ward.description }}
      </span>
    </span>
  </div>
</template>

<style scoped>
.coming-soon-ward {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.coming-soon-ward:hover {
  transform: translateY(-1px);
  opacity: 0.85;
  border-color: #d4d4d4;
  background-color: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

:global(.dark) .coming-soon-ward:hover {
  border-color: #525252;
  background-color: rgba(38, 38, 38, 0.85);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

.coming-soon-ward:hover .coming-soon-ward__badge {
  background-color: #e5e5e5;
  letter-spacing: 0.06em;
}

:global(.dark) .coming-soon-ward:hover .coming-soon-ward__badge {
  background-color: #525252;
}

.coming-soon-ward__icon {
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.coming-soon-ward:hover .coming-soon-ward__icon {
  background-color: #e5e5e5;
  color: #525252;
}

:global(.dark) .coming-soon-ward:hover .coming-soon-ward__icon {
  background-color: #404040;
  color: #d4d4d4;
}
</style>
