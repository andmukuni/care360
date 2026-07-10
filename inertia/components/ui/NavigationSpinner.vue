<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'

const visible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | null = null
const cleanups: Array<() => void> = []

function scheduleShow() {
  if (showTimer) return
  // Small delay so instant page loads don't flash the spinner.
  showTimer = setTimeout(() => {
    visible.value = true
  }, 150)
}

function hide() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  visible.value = false
}

onMounted(() => {
  cleanups.push(router.on('start', scheduleShow))
  cleanups.push(router.on('finish', hide))
})

onUnmounted(() => {
  hide()
  cleanups.forEach((off) => off())
})
</script>

<template>
  <Transition name="nav-spinner-fade">
    <div v-if="visible" class="nav-spinner" role="status" aria-live="polite" aria-label="Loading">
      <svg class="nav-spinner__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="nav-spinner__track" cx="12" cy="12" r="9" stroke-width="3" />
        <path class="nav-spinner__head" d="M21 12a9 9 0 0 0-9-9" stroke-width="3" stroke-linecap="round" />
      </svg>
      <span class="nav-spinner__label">Loading…</span>
    </div>
  </Transition>
</template>

<style scoped>
.nav-spinner {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 9999px;
  background: rgba(23, 23, 23, 0.92);
  color: #fafafa;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.nav-spinner__icon {
  width: 1rem;
  height: 1rem;
  animation: nav-spinner-rotate 0.7s linear infinite;
}

.nav-spinner__track {
  stroke: rgba(250, 250, 250, 0.25);
}

.nav-spinner__head {
  stroke: #fafafa;
}

.nav-spinner__label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

@keyframes nav-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

.nav-spinner-fade-enter-active,
.nav-spinner-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.nav-spinner-fade-enter-from,
.nav-spinner-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
