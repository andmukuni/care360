<script setup lang="ts">
import { computed } from 'vue'

type UserBadgeData = {
  name: string
  role?: string | null
}

const props = withDefaults(
  defineProps<{
    user?: UserBadgeData | null
    name?: string | null
    role?: string | null
    size?: 'sm' | 'md'
    showName?: boolean
    showRole?: boolean
  }>(),
  {
    size: 'sm',
    showName: true,
    showRole: true,
  }
)

const displayName = computed(() => {
  const value = props.user?.name ?? props.name
  return value ? String(value).trim() : null
})

const displayRole = computed(() => {
  const role = props.user?.role ?? props.role
  return role ? String(role).trim() : 'Staff'
})

const initials = computed(() => {
  const value = displayName.value
  if (!value) return 'U'
  return value.slice(0, 2).toUpperCase()
})
</script>

<template>
  <span v-if="!displayName" class="text-neutral-400">—</span>
  <span
    v-else
    class="user-badge"
    :class="size === 'md' ? 'user-badge--md' : 'user-badge--sm'"
  >
    <div class="staff-navbar__avatar" :title="displayName">
      {{ initials }}
      <span class="staff-navbar__avatar-ring" aria-hidden="true" />
    </div>
    <div v-if="showName" class="user-badge__info">
      <div class="staff-navbar__user-name">{{ displayName }}</div>
      <div v-if="showRole" class="staff-navbar__user-role">{{ displayRole }}</div>
    </div>
  </span>
</template>
