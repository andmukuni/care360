<script setup lang="ts">
import { computed } from 'vue'
import FieldWithSuggestions from '~/components/clinical/FieldWithSuggestions.vue'

const props = defineProps<{
  fields: Record<string, { id: number; text: string; source?: Record<string, unknown> }[]>
  disabled?: boolean
}>()

const emit = defineEmits<{
  applyAll: [updates: Record<string, string>]
}>()

const counts = computed(() =>
  Object.entries(props.fields)
    .filter(([, items]) => items.length > 0)
    .map(([key, items]) => ({ key, count: items.length }))
)

const totalCount = computed(() => counts.value.reduce((sum, c) => sum + c.count, 0))

function applyAll(models: Record<string, string>) {
  const updates: Record<string, string> = {}
  for (const { key } of counts.value) {
    const texts = (props.fields[key] ?? []).map((s) => s.text)
    if (!texts.length) continue
    const existing = String(models[key] ?? '').trim()
    updates[key] = existing ? `${existing}\n${texts.join('\n')}` : texts.join('\n')
  }
  emit('applyAll', updates)
}
</script>

<template>
  <div
    v-if="totalCount > 0 && !disabled"
    class="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/25"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="text-xs font-bold text-indigo-900 dark:text-indigo-200">Clinical suggestions available</p>
        <p class="text-[10px] text-indigo-700/90 dark:text-indigo-300/80">
          Based on lab results —
          <span v-for="(c, i) in counts" :key="c.key">
            {{ c.count }} for {{ c.key.replace(/_/g, ' ') }}<span v-if="i < counts.length - 1">, </span>
          </span>
        </p>
      </div>
      <slot name="apply-all" :apply-all="applyAll" />
    </div>
  </div>
</template>
