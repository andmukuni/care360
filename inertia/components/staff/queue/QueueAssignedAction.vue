<script setup lang="ts">
import { computed } from 'vue'
import UserBadge from '~/components/staff/UserBadge.vue'

type QueueUser = {
  name: string
  role?: string | null
}

const props = defineProps<{
  user?: QueueUser | null
  name?: string | null
}>()

const displayName = computed(() => {
  const value = props.user?.name ?? props.name
  return value ? String(value).trim() : 'another user'
})
</script>

<template>
  <div
    class="queue-assigned-action"
    :title="`Assigned to ${displayName}`"
    :aria-label="`Assigned to ${displayName}`"
  >
    <UserBadge :user="props.user" :name="props.name" size="sm" />
  </div>
</template>
