<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    photoUrl?: string | null
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  }
)

const initials = computed(() => {
  const value = props.name.trim()
  if (!value) return 'U'
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return value.slice(0, 2).toUpperCase()
})
</script>

<template>
  <div
    class="user-avatar"
    :class="`user-avatar--${size}`"
    :title="name"
    role="img"
    :aria-label="`${name} avatar`"
  >
    <img v-if="photoUrl" :src="photoUrl" :alt="name" class="user-avatar__img" />
    <span v-else class="user-avatar__initials">{{ initials }}</span>
  </div>
</template>
