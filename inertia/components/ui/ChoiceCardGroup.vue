<script setup lang="ts">
export type ChoiceOption = {
  value: string
  label: string
  hint?: string
}

const model = defineModel<string | null>({ required: true })

defineProps<{
  options: ChoiceOption[]
  disabled?: boolean
  columns?: 2 | 3 | 4
}>()

function select(value: string) {
  model.value = value
}
</script>

<template>
  <div class="choice-card-grid" :class="`choice-card-grid--cols-${columns ?? 3}`">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="choice-card"
      :class="{ 'choice-card--active': model === opt.value }"
      :disabled="disabled"
      @click="select(opt.value)"
    >
      <span class="choice-card__radio" aria-hidden="true">
        <span class="choice-card__radio-dot" />
      </span>
      <span class="choice-card__body">
        <span class="choice-card__label">{{ opt.label }}</span>
        <span v-if="opt.hint" class="choice-card__hint">{{ opt.hint }}</span>
      </span>
      <svg
        v-if="model === opt.value"
        class="choice-card__check"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.choice-card-grid {
  display: grid;
  gap: 0.65rem;
  width: 100%;
}
.choice-card-grid--cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.choice-card-grid--cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.choice-card-grid--cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
@media (max-width: 640px) {
  .choice-card-grid--cols-3,
  .choice-card-grid--cols-4 {
    grid-template-columns: 1fr;
  }
}
.choice-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 1.5px solid #e5e5e5;
  border-radius: 0.625rem;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}
.choice-card:hover:not(:disabled) {
  border-color: #d4d4d4;
  background: #fafafa;
}
.choice-card--active {
  border-color: #171717;
  background: #fafafa;
  box-shadow: 0 0 0 1px #171717;
}
.choice-card:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
:global(.dark) .choice-card {
  border-color: rgba(255, 255, 255, 0.05);
  background: #121212;
}
:global(.dark) .choice-card:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.07);
  background: #1a1a1a;
}
:global(.dark) .choice-card--active {
  border-color: rgba(255, 255, 255, 0.1);
  background: #1a1a1a;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.choice-card__radio {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  flex-shrink: 0;
  border: 2px solid #d4d4d4;
  border-radius: 9999px;
  transition: border-color 0.15s ease;
}
.choice-card--active .choice-card__radio {
  border-color: #171717;
}
.choice-card__radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: transparent;
  transition: background 0.15s ease;
}
.choice-card--active .choice-card__radio-dot {
  background: #171717;
}
:global(.dark) .choice-card__radio {
  border-color: rgba(255, 255, 255, 0.14);
}
:global(.dark) .choice-card--active .choice-card__radio {
  border-color: rgba(255, 255, 255, 0.22);
}
:global(.dark) .choice-card--active .choice-card__radio-dot {
  background: #e5e5e5;
}
.choice-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}
.choice-card__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #171717;
  line-height: 1.3;
}
:global(.dark) .choice-card__label {
  color: #f5f5f5;
}
.choice-card__hint {
  font-size: 0.6875rem;
  color: #737373;
  line-height: 1.35;
}
:global(.dark) .choice-card__hint {
  color: #a3a3a3;
}
.choice-card__check {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  width: 14px;
  height: 14px;
  color: #171717;
}
:global(.dark) .choice-card__check {
  color: #e5e5e5;
}
</style>
