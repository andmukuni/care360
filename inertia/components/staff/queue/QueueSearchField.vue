<script setup lang="ts">
defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  hint?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="queue-search">
    <label class="queue-search-label">{{ label ?? 'Search queue' }}</label>
    <div class="queue-search-input-wrap">
      <svg class="queue-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        :value="modelValue"
        type="search"
        class="queue-search-input"
        :placeholder="placeholder ?? 'Search by patient name, ID, or barcode…'"
        autocomplete="off"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <p v-if="hint && modelValue.trim() !== ''" class="queue-search-hint">{{ hint }}</p>
  </div>
</template>
