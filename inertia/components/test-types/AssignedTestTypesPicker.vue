<script setup lang="ts">
import { computed, ref } from 'vue'

export type TestTypeOption = {
  id: number
  name: string
  category: string | null
  current_form?: string | null
}

const selectedIds = defineModel<number[]>({ required: true })

const props = defineProps<{
  testTypes: TestTypeOption[]
}>()

const search = ref('')

const filteredTestTypes = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) {
    return props.testTypes
  }

  return props.testTypes.filter((testType) => {
    const haystack = [testType.name, testType.category, testType.current_form]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(term)
  })
})

const selectedCount = computed(() => selectedIds.value.length)
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Search test types…"
        class="theme-field w-full max-w-sm rounded px-3 py-1.5 text-sm placeholder:text-neutral-400"
      />
      <p class="text-xs text-sand-11 dark:text-neutral-400">
        {{ filteredTestTypes.length }} shown
        <span v-if="search.trim()"> of {{ testTypes.length }}</span>
        · {{ selectedCount }} selected
      </p>
    </div>

    <div class="max-h-96 overflow-y-auto rounded border border-sand-4 p-3 dark:border-neutral-700">
      <div v-if="filteredTestTypes.length" class="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
        <label
          v-for="testType in filteredTestTypes"
          :key="testType.id"
          class="flex items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-sand-2 dark:hover:bg-neutral-800"
        >
          <input v-model="selectedIds" type="checkbox" :value="testType.id" class="mt-0.5 shrink-0" />
          <span class="min-w-0">
            <span class="block leading-snug">{{ testType.name }}</span>
            <span
              v-if="testType.category || testType.current_form"
              class="mt-0.5 block text-[10px] leading-tight text-sand-11 dark:text-neutral-500"
            >
              <template v-if="testType.category">{{ testType.category }}</template>
              <template v-if="testType.category && testType.current_form"> · </template>
              <template v-if="testType.current_form">Form: {{ testType.current_form }}</template>
            </span>
          </span>
        </label>
      </div>
      <p v-else class="py-6 text-center text-sm text-sand-11 dark:text-neutral-400">
        No test types match your search.
      </p>
    </div>
  </div>
</template>
