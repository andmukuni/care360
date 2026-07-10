<script setup lang="ts">
import { useGlobalAutosaveState } from '~/composables/useAutosaveRegistry'

const { globalStatus, globalText, visible, canRetry, retryAll } = useGlobalAutosaveState()
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="global-autosave-indicator"
    role="status"
    aria-live="polite"
    :class="{
      'global-autosave-indicator--pending': globalStatus === 'pending',
      'global-autosave-indicator--saving': globalStatus === 'saving',
      'global-autosave-indicator--error': globalStatus === 'error',
    }"
    :title="canRetry ? 'Click to retry save' : undefined"
    :disabled="globalStatus === 'saving'"
    @click="canRetry ? retryAll() : undefined"
  >
    <span
      v-if="globalStatus === 'saving'"
      class="global-autosave-indicator__spinner"
      aria-hidden="true"
    />
    <span>{{ globalText }}</span>
    <span v-if="canRetry" class="global-autosave-indicator__retry">Retry</span>
  </button>
</template>

<style scoped>
.global-autosave-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid #e5e5e5;
  background: #fafafa;
  color: #525252;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.25rem;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.global-autosave-indicator--pending {
  border-color: #e5e5e5;
  background: #fafafa;
  color: #525252;
}

.global-autosave-indicator--saving {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.global-autosave-indicator--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  cursor: pointer;
}

.global-autosave-indicator--error:hover:not(:disabled) {
  background: #fee2e2;
}

.global-autosave-indicator:disabled {
  cursor: default;
}

.global-autosave-indicator__retry {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.global-autosave-indicator__spinner {
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 9999px;
  animation: global-autosave-spin 0.8s linear infinite;
}

:global(.dark) .global-autosave-indicator--pending {
  border-color: #404040;
  background: #262626;
  color: #d4d4d4;
}

:global(.dark) .global-autosave-indicator--saving {
  border-color: #1e3a8a;
  background: #172554;
  color: #93c5fd;
}

:global(.dark) .global-autosave-indicator--error {
  border-color: #7f1d1d;
  background: #450a0a;
  color: #fca5a5;
}

@keyframes global-autosave-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
