<script setup lang="ts">
const model = defineModel<boolean | null>({ required: true })

defineProps<{
  disabled?: boolean
  naLabel?: string
  yesLabel?: string
  noLabel?: string
}>()

function setValue(value: boolean | null) {
  model.value = value
}
</script>

<template>
  <div class="tri-state" role="group">
    <button
      type="button"
      class="tri-state__btn tri-state__btn--na"
      :class="{ 'tri-state__btn--active': model === null }"
      :disabled="disabled"
      @click="setValue(null)"
    >
      {{ naLabel ?? 'N/A' }}
    </button>
    <button
      type="button"
      class="tri-state__btn tri-state__btn--yes"
      :class="{ 'tri-state__btn--active': model === true }"
      :disabled="disabled"
      @click="setValue(true)"
    >
      <svg class="tri-state__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
      {{ yesLabel ?? 'Yes' }}
    </button>
    <button
      type="button"
      class="tri-state__btn tri-state__btn--no"
      :class="{ 'tri-state__btn--active': model === false }"
      :disabled="disabled"
      @click="setValue(false)"
    >
      <svg class="tri-state__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
      {{ noLabel ?? 'No' }}
    </button>
  </div>
</template>

<style scoped>
.tri-state {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  width: 100%;
}
.tri-state__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.55rem 0.5rem;
  border: 1.5px solid #e5e5e5;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #737373;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}
.tri-state__btn:hover:not(:disabled) {
  border-color: #d4d4d4;
  background: #fafafa;
}
.tri-state__btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.tri-state__icon {
  width: 12px;
  height: 12px;
}
.tri-state__btn--na.tri-state__btn--active {
  border-color: #a3a3a3;
  background: #f5f5f5;
  color: #404040;
  box-shadow: inset 0 0 0 1px #a3a3a3;
}
.tri-state__btn--yes.tri-state__btn--active {
  border-color: #16a34a;
  background: #f0fdf4;
  color: #166534;
  box-shadow: inset 0 0 0 1px #16a34a;
}
.tri-state__btn--no.tri-state__btn--active {
  border-color: #dc2626;
  background: #fef2f2;
  color: #991b1b;
  box-shadow: inset 0 0 0 1px #dc2626;
}
:global(.dark) .tri-state__btn {
  border-color: #404040;
  background: #171717;
  color: #a3a3a3;
}
:global(.dark) .tri-state__btn:hover:not(:disabled) {
  background: #262626;
}
:global(.dark) .tri-state__btn--na.tri-state__btn--active {
  border-color: #737373;
  background: #262626;
  color: #e5e5e5;
}
:global(.dark) .tri-state__btn--yes.tri-state__btn--active {
  border-color: #22c55e;
  background: #052e16;
  color: #86efac;
}
:global(.dark) .tri-state__btn--no.tri-state__btn--active {
  border-color: #ef4444;
  background: #450a0a;
  color: #fca5a5;
}
</style>
