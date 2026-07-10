<script setup lang="ts">
import { computed, ref } from 'vue'

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

const imageFailed = ref(false)

const resolvedPhotoUrl = computed(() => {
  if (imageFailed.value || !props.photoUrl) {
    return null
  }

  return props.photoUrl
})

const initials = computed(() => {
  const value = props.name.trim()
  if (!value) return 'U'
  return value.slice(0, 2).toUpperCase()
})

function onImageError() {
  imageFailed.value = true
}
</script>

<template>
  <div
    class="staff-navbar__avatar user-avatar-badge"
    :class="`user-avatar-badge--${size}`"
    :title="name"
    role="img"
    :aria-label="`${name} avatar`"
  >
    <img
      v-if="resolvedPhotoUrl"
      :src="resolvedPhotoUrl"
      :alt="name"
      class="user-avatar-badge__img"
      @error="onImageError"
    />
    <template v-else>{{ initials }}</template>
    <span class="staff-navbar__avatar-ring" aria-hidden="true" />
  </div>
</template>
