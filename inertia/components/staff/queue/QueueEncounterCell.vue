<script setup lang="ts">
import { computed } from 'vue'
import EncounterBadge from '~/components/encounter/EncounterBadge.vue'
import QueuePrioritySelect from '~/components/staff/queue/QueuePrioritySelect.vue'
import { shouldShowPriorityBadge } from '~/support/priority_badges'

const props = defineProps<{
  encounterNumber: string
  timePrefix: string
  timeRelative?: string | null
  extra?: string | null
  priority?: string | null
  encounterId?: number
  canChangePriority?: boolean
}>()

const showBadge = computed(() => shouldShowPriorityBadge(props.priority))
const showPriorityControl = computed(
  () => Boolean(props.canChangePriority && props.encounterId)
)
</script>

<template>
  <div class="queue-cell-inline queue-cell-inline--nowrap">
    <span class="queue-cell-main">{{ encounterNumber }}</span>
    <QueuePrioritySelect
      v-if="showPriorityControl"
      :encounter-id="encounterId!"
      :priority="priority"
    />
    <EncounterBadge
      v-else-if="showBadge"
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
