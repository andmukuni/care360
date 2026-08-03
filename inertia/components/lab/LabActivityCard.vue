<script setup lang="ts">
defineProps<{
  activity: {
    id: number
    headline: string
    stage_label: string
    action_by: string | null
    action_at: string | null
    notes: string | null
    detail: string | null
  }[]
}>()
</script>

<template>
  <div class="theme-surface overflow-hidden rounded-lg shadow-sm">
    <div class="theme-card-header px-4 py-3">
      <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
        Lab Activity
      </h3>
      <p class="mt-0.5 text-[11px] text-neutral-500">Who recorded what on this encounter</p>
    </div>
    <div class="max-h-80 overflow-y-auto px-4 py-3">
      <ul v-if="activity.length" class="space-y-3">
        <li
          v-for="item in activity"
          :key="item.id"
          class="border-l-2 border-neutral-200 pl-3 dark:border-neutral-700"
        >
          <div class="text-sm font-medium text-neutral-900 dark:text-white">{{ item.headline }}</div>
          <div class="mt-0.5 text-[11px] text-neutral-500">
            {{ item.stage_label }}
            <template v-if="item.action_by"> · {{ item.action_by }}</template>
            <template v-if="item.action_at"> · {{ item.action_at }}</template>
          </div>
          <p v-if="item.detail" class="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
            {{ item.detail }}
          </p>
          <p v-if="item.notes" class="mt-1 text-xs italic text-neutral-500">{{ item.notes }}</p>
        </li>
      </ul>
      <p v-else class="text-sm italic text-neutral-400">No lab activity recorded yet.</p>
    </div>
  </div>
</template>
