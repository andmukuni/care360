<script setup lang="ts">
import UserBadge from '~/components/staff/UserBadge.vue'

type QueueUser = {
  name: string
  role?: string | null
}

const props = defineProps<{
  user?: QueueUser | null
  name?: string | null
}>()
</script>

<template>
  <div class="queue-assigned-action" title="Assigned to another staff member">
    <span class="queue-assigned-action__icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
        <path
          fill-rule="evenodd"
          d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
          clip-rule="evenodd"
        />
      </svg>
    </span>
    <UserBadge :user="props.user" :name="props.name" size="sm" />
  </div>
</template>
