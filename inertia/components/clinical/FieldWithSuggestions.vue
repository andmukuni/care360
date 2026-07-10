<script setup lang="ts">
import { computed, ref } from 'vue'

export type FieldSuggestionItem = {
  id: number
  text: string
  source?: {
    test_name?: string | null
    result?: string | null
    trigger?: string | null
  }
}

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    label?: string
    required?: boolean
    disabled?: boolean
    rows?: number
    placeholder?: string
    suggestions?: FieldSuggestionItem[]
    error?: string | null
  }>(),
  {
    rows: 2,
    suggestions: () => [],
    error: null,
  }
)

const emit = defineEmits<{
  applied: []
}>()

const dismissed = ref<Set<number>>(new Set())

const visibleSuggestions = computed(() =>
  props.suggestions.filter((s) => !dismissed.value.has(s.id))
)

function sourceLabel(item: FieldSuggestionItem): string {
  if (item.source?.test_name) {
    return `${item.source.test_name}${item.source.result ? ` · ${item.source.result}` : ''}`
  }
  if (item.source?.trigger) return `Trigger: ${item.source.trigger}`
  return 'Clinical rule'
}

function apply(text: string) {
  model.value = text
  emit('applied')
}

function append(text: string) {
  const current = model.value.trim()
  model.value = current ? `${current}\n${text}` : text
  emit('applied')
}

function dismiss(id: number) {
  dismissed.value = new Set([...dismissed.value, id])
}
</script>

<template>
  <div>
    <label v-if="label" class="field-label">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <textarea
      v-model="model"
      :disabled="disabled"
      :rows="rows"
      class="field-input text-sm"
      :placeholder="placeholder"
    />
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>

    <div v-if="visibleSuggestions.length && !disabled" class="mt-2 space-y-1.5">
      <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Suggested</p>
      <div
        v-for="item in visibleSuggestions"
        :key="item.id"
        class="flex flex-wrap items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 dark:border-sky-900 dark:bg-sky-950/30"
      >
        <div class="min-w-0 flex-1">
          <p class="text-xs text-neutral-800 dark:text-neutral-200">{{ item.text }}</p>
          <p class="mt-0.5 text-[10px] text-neutral-500" :title="sourceLabel(item)">
            {{ sourceLabel(item) }}
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap gap-1">
          <button
            type="button"
            class="theme-icon-btn rounded px-2 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-100 dark:text-sky-200"
            @click="apply(item.text)"
          >
            Apply
          </button>
          <button
            type="button"
            class="theme-icon-btn rounded px-2 py-0.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200"
            @click="append(item.text)"
          >
            Append
          </button>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-600"
            aria-label="Dismiss suggestion"
            @click="dismiss(item.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
