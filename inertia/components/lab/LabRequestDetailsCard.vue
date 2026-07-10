<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    priority: string
    notes: string
    editable?: boolean
    requestNumber?: string | null
    status?: string | null
  }>(),
  {
    editable: false,
    requestNumber: null,
    status: null,
  }
)

const emit = defineEmits<{
  'update:priority': [value: string]
  'update:notes': [value: string]
}>()

const priorityOptions = [
  { value: 'normal', label: 'Normal', desc: 'Routine processing', tone: 'neutral' },
  { value: 'urgent', label: 'Urgent', desc: 'Prioritize today', tone: 'amber' },
  { value: 'stat', label: 'STAT', desc: 'Immediate attention', tone: 'red' },
] as const

const activePriority = computed(
  () => priorityOptions.find((option) => option.value === props.priority) ?? priorityOptions[0]
)

function selectPriority(value: string) {
  if (!props.editable) return
  emit('update:priority', value)
}

function priorityBadgeClass(tone: 'neutral' | 'amber' | 'red') {
  if (tone === 'red') return 'lab-priority-badge--stat'
  if (tone === 'amber') return 'lab-priority-badge--urgent'
  return 'lab-priority-badge--normal'
}

function statusBadgeClass(status: string | null) {
  if (status === 'completed') return 'lab-request-status--completed'
  if (status === 'cancelled') return 'lab-request-status--cancelled'
  return 'lab-request-status--open'
}
</script>

<template>
  <div class="lab-request-details">
    <div class="lab-request-details__header">
      <div>
        <h3 class="lab-request-details__title">Request Details</h3>
        <p class="lab-request-details__subtitle">Priority and clinical context for the lab team</p>
      </div>
      <div v-if="requestNumber || status" class="lab-request-details__meta">
        <span v-if="requestNumber" class="lab-request-details__number">{{ requestNumber }}</span>
        <span v-if="status" class="lab-request-status" :class="statusBadgeClass(status)">{{ status }}</span>
      </div>
    </div>

    <div class="lab-request-details__body">
      <div class="lab-request-details__priority-block">
        <label class="field-label">Priority</label>

        <div v-if="editable" class="lab-priority-options" role="radiogroup" aria-label="Lab request priority">
          <button
            v-for="option in priorityOptions"
            :key="option.value"
            type="button"
            class="lab-priority-option"
            :class="[
              `lab-priority-option--${option.tone}`,
              priority === option.value ? 'lab-priority-option--active' : '',
            ]"
            :aria-pressed="priority === option.value"
            @click="selectPriority(option.value)"
          >
            <span class="lab-priority-option__label">{{ option.label }}</span>
            <span class="lab-priority-option__desc">{{ option.desc }}</span>
          </button>
        </div>

        <div v-else class="lab-priority-readonly">
          <span class="lab-priority-badge" :class="priorityBadgeClass(activePriority.tone)">
            {{ activePriority.label }}
          </span>
          <span class="lab-priority-readonly__desc">{{ activePriority.desc }}</span>
        </div>
      </div>

      <div class="lab-request-details__notes-block">
        <label class="field-label">
          Request Notes
          <span v-if="editable" class="text-xs font-normal text-neutral-400">(optional)</span>
        </label>

        <textarea
          v-if="editable"
          :value="notes"
          rows="3"
          class="field-input lab-request-details__notes-input"
          placeholder="Clinical context for the lab team — symptoms, fasting status, suspected diagnosis…"
          @input="emit('update:notes', ($event.target as HTMLTextAreaElement).value)"
        />

        <div v-else-if="notes?.trim()" class="lab-request-notes-readonly">
          {{ notes }}
        </div>
        <p v-else class="lab-request-notes-empty">No request notes provided.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-request-details {
  overflow: hidden;
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
  background: #fff;
}

:global(.dark) .lab-request-details {
  border-color: #404040;
  background: #171717;
}

.lab-request-details__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid #f0f0f0;
  padding: 0.9rem 1.1rem;
  background: linear-gradient(180deg, #f8fbfd 0%, #f3f7fb 100%);
}

:global(.dark) .lab-request-details__header {
  border-bottom-color: #333;
  background: linear-gradient(180deg, #1f2937 0%, #1a2332 100%);
}

.lab-request-details__title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #171717;
}

:global(.dark) .lab-request-details__title {
  color: #f5f5f5;
}

.lab-request-details__subtitle {
  margin-top: 0.15rem;
  font-size: 0.6875rem;
  color: #737373;
}

:global(.dark) .lab-request-details__subtitle {
  color: #a3a3a3;
}

.lab-request-details__meta {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.lab-request-details__number {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.625rem;
  font-weight: 700;
  color: #525252;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  border: 1px solid #e5e5e5;
  background: #fff;
}

:global(.dark) .lab-request-details__number {
  color: #d4d4d4;
  border-color: #404040;
  background: #262626;
}

.lab-request-status {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.lab-request-status--open {
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.lab-request-status--completed {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.lab-request-status--cancelled {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.lab-request-details__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem 1.1rem 1.1rem;
}

@media (min-width: 768px) {
  .lab-request-details__body {
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    align-items: start;
    gap: 1.25rem;
  }
}

.lab-request-details__priority-block,
.lab-request-details__notes-block {
  min-width: 0;
}

.lab-priority-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

@media (max-width: 640px) {
  .lab-priority-options {
    grid-template-columns: 1fr;
  }
}

.lab-priority-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
  background: #fafafa;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.lab-priority-option:hover {
  border-color: #d4d4d4;
  background: #f5f5f5;
}

:global(.dark) .lab-priority-option {
  border-color: #404040;
  background: #262626;
}

:global(.dark) .lab-priority-option:hover {
  border-color: #525252;
  background: #2a2a2a;
}

.lab-priority-option--active {
  box-shadow: 0 0 0 1px inset;
}

.lab-priority-option--neutral.lab-priority-option--active {
  border-color: #525252;
  box-shadow: 0 0 0 1px #525252 inset;
  background: #fff;
}

.lab-priority-option--amber.lab-priority-option--active {
  border-color: #d97706;
  box-shadow: 0 0 0 1px #d97706 inset;
  background: #fffbeb;
}

.lab-priority-option--red.lab-priority-option--active {
  border-color: #dc2626;
  box-shadow: 0 0 0 1px #dc2626 inset;
  background: #fef2f2;
}

.lab-priority-option__label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #171717;
}

:global(.dark) .lab-priority-option__label {
  color: #f5f5f5;
}

.lab-priority-option__desc {
  font-size: 0.625rem;
  color: #737373;
}

.lab-priority-readonly {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lab-priority-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lab-priority-badge--normal {
  color: #525252;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
}

.lab-priority-badge--urgent {
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.lab-priority-badge--stat {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.lab-priority-readonly__desc {
  font-size: 0.6875rem;
  color: #737373;
}

.lab-request-details__notes-input {
  min-height: 5.5rem;
  resize: vertical;
}

.lab-request-notes-readonly {
  min-height: 5.5rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
  background: #fafafa;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #404040;
  white-space: pre-line;
}

:global(.dark) .lab-request-notes-readonly {
  border-color: #404040;
  background: #262626;
  color: #d4d4d4;
}

.lab-request-notes-empty {
  min-height: 5.5rem;
  display: flex;
  align-items: center;
  padding: 0.75rem 0.85rem;
  border: 1px dashed #e5e5e5;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: #a3a3a3;
}

:global(.dark) .lab-request-notes-empty {
  border-color: #404040;
  color: #737373;
}
</style>
