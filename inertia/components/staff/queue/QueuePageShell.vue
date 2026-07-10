<script setup lang="ts">
import type { QueueTab } from '~/composables/useStageQueue'
import QueueTabs from '~/components/staff/queue/QueueTabs.vue'
import QueueLiveIndicator from '~/components/staff/queue/QueueLiveIndicator.vue'

defineProps<{
  title: string
  description?: string
  tab: QueueTab
  queuedTotal: number
  inProgressTotal: number
  partiallyDispensedTotal?: number
  closedTotal?: number
  waitingLabel?: string
  progressLabel?: string
  partiallyDispensedLabel?: string
  closedLabel?: string
  theme?: 'default' | 'treatment'
  isRegistrationClerk?: boolean
}>()

defineEmits<{
  'update:tab': [value: QueueTab]
}>()
</script>

<template>
  <div class="queue-page w-full space-y-5">
    <header class="queue-page-header">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="queue-page-title">{{ title }}</h1>
          <QueueLiveIndicator />
        </div>
        <p v-if="description" class="queue-page-description">{{ description }}</p>
      </div>
    </header>

    <div
      v-if="isRegistrationClerk"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      Registration clerk access is read-only on this queue. Receive and record actions are disabled.
    </div>

    <slot v-if="$slots.categories" name="categories" />

    <QueueTabs
      :tab="tab"
      :queued-total="queuedTotal"
      :in-progress-total="inProgressTotal"
      :partially-dispensed-total="partiallyDispensedTotal"
      :closed-total="closedTotal"
      :waiting-label="waitingLabel"
      :progress-label="progressLabel"
      :partially-dispensed-label="partiallyDispensedLabel"
      :closed-label="closedLabel"
      :theme="theme"
      @update:tab="$emit('update:tab', $event)"
    />

    <slot v-if="$slots.toolbar" name="toolbar" />

    <slot />
  </div>
</template>
