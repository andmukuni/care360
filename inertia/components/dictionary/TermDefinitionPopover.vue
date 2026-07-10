<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  termId?: number | null
  label?: string | null
  definition?: string | null
  code?: string | null
  hierarchyPath?: string | null
}>()

const open = ref(false)
const loading = ref(false)
const fetched = ref<{
  definition: string | null
  code: string | null
  hierarchy_path: string | null
  label: string
} | null>(null)

const hasContent = computed(
  () => Boolean(props.definition || fetched.value?.definition || props.code || props.hierarchyPath)
)

async function loadIfNeeded() {
  if (!props.termId || props.definition || fetched.value) return
  loading.value = true
  try {
    const res = await fetch(`/dictionary/terms/${props.termId}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    if (res.ok) {
      const data = await res.json()
      fetched.value = {
        definition: data.definition ?? null,
        code: data.code ?? null,
        hierarchy_path: data.hierarchy_path ?? null,
        label: data.label ?? props.label ?? '',
      }
    }
  } finally {
    loading.value = false
  }
}

watch(open, (value) => {
  if (value) void loadIfNeeded()
})

const displayDefinition = computed(
  () => props.definition || fetched.value?.definition || 'No definition yet — admins can add one in Medical Library.'
)
const displayCode = computed(() => props.code || fetched.value?.code || null)
const displayPath = computed(() => props.hierarchyPath || fetched.value?.hierarchy_path || null)
</script>

<template>
  <span class="relative inline-flex align-middle">
    <button
      type="button"
      class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-teal-300 bg-teal-50 text-[10px] font-bold text-teal-800 hover:bg-teal-100"
      :aria-label="`Definition for ${label || 'term'}`"
      @click.stop="open = !open"
    >
      ?
    </button>
    <div
      v-if="open"
      class="absolute left-0 z-40 mt-6 w-72 rounded-lg border border-teal-200 bg-white p-3 text-left shadow-lg dark:border-teal-800 dark:bg-neutral-900"
    >
      <div class="mb-1 flex items-start justify-between gap-2">
        <p class="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
          {{ label || fetched?.label || 'Term' }}
        </p>
        <button type="button" class="text-xs text-neutral-400 hover:text-neutral-700" @click="open = false">
          ✕
        </button>
      </div>
      <p v-if="displayCode" class="mb-1 font-mono text-[11px] text-teal-700 dark:text-teal-300">
        {{ displayCode }}
      </p>
      <p v-if="displayPath" class="mb-2 text-[11px] text-neutral-500">{{ displayPath }}</p>
      <p v-if="loading" class="text-xs text-neutral-500">Loading…</p>
      <p v-else class="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        {{ displayDefinition }}
      </p>
      <p v-if="!hasContent && !loading" class="mt-1 text-[10px] text-neutral-400">
        Tip: open Catalog → Medical Library to add definitions.
      </p>
    </div>
  </span>
</template>
