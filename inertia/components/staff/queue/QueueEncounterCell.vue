<script setup lang="ts">
import { computed } from 'vue'
import EncounterBadge from '~/components/encounter/EncounterBadge.vue'
import { shouldShowPriorityBadge } from '~/support/priority_badges'

const props = defineProps<{
  encounterNumber: string
  timePrefix: string
  timeRelative?: string | null
  extra?: string | null
  priority?: string | null
}>()

const showBadge = computed(() => shouldShowPriorityBadge(props.priority))
</script>

<template>
  <div class="queue-cell-inline queue-cell-inline--nowrap">
    <span class="queue-cell-main">{{ encounterNumber }}</span>
    <EncounterBadge
      v-if="showBadge"
      type="priority"
      :value="priority ?? 'normal'"
      class="queue-cell-inline-badge"
    />
    <span class="queue-cell-sep" aria-hidden="true">·</span>
    <span class="queue-cell-sub">
      {{ timePrefix }}<template v-if="timeRelative"> {{ timeRelative }}</template>
    </span>
    <template v-if="extra">
      <span class="queue-cell-sep" aria-hidden="true">·</span>
      <span class="queue-cell-sub">{{ extra }}</span>
    </template>
    <slot />
  </div>
</template>
