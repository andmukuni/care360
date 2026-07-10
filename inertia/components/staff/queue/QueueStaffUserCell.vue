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
  <UserBadge :user="props.user" :name="props.name" size="sm" />
</template>
