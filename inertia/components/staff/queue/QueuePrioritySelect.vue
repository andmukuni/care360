<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { normalizePriority } from '~/support/priority_badges'
import { coerceNumericId } from '~/support/coerce_id'

const props = defineProps<{
  encounterId: number | string
  priority?: string | null
  disabled?: boolean
}>()

const resolvedEncounterId = computed(() => coerceNumericId(props.encounterId))

const OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
] as const

const saving = ref(false)
const localValue = ref(normalizePriority(props.priority) || 'normal')

watch(
  () => props.priority,
  (value) => {
    localValue.value = normalizePriority(value) || 'normal'
  }
)

const selectClass = computed(() => {
  const key = localValue.value
  if (key === 'emergency') return 'queue-priority-select queue-priority-select--emergency'
  if (key === 'urgent') return 'queue-priority-select queue-priority-select--urgent'
  return 'queue-priority-select queue-priority-select--normal'
})

function onChange(event: Event) {
  const next = normalizePriority((event.target as HTMLSelectElement).value) || 'normal'
  if (!OPTIONS.some((option) => option.value === next) || next === localValue.value) {
    localValue.value = normalizePriority(props.priority) || 'normal'
    return
  }

  const previous = localValue.value
  localValue.value = next
  saving.value = true
  const encounterId = resolvedEncounterId.value
  if (encounterId === null) {
    localValue.value = previous
    saving.value = false
    return
  }
  router.patch(
    `/encounters/${encounterId}/priority`,
    { priority_level: next },
    {
      preserveScroll: true,
      onError: () => {
        localValue.value = previous
      },
      onFinish: () => {
        saving.value = false
      },
    }
  )
}
</script>

<template>
  <select
    :class="selectClass"
    :value="localValue"
    :disabled="disabled || saving"
    :aria-label="'Change priority'"
    @change="onChange"
  >
    <option v-for="option in OPTIONS" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
</template>
