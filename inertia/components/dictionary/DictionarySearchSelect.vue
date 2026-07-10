<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import TermDefinitionPopover from '~/components/dictionary/TermDefinitionPopover.vue'

export type DictionaryPick = {
  id: number
  label: string
  code: string | null
  definition: string | null
  hierarchy_path: string | null
  domain: string
  source: string
}

const props = withDefaults(
  defineProps<{
    domain: 'diagnosis' | 'drug' | 'lab' | 'symptom'
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    limit?: number
  }>(),
  {
    modelValue: '',
    placeholder: 'Search medical library…',
    disabled: false,
    limit: 20,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [term: DictionaryPick]
}>()

const query = ref(props.modelValue)
const open = ref(false)
const loading = ref(false)
const results = ref<DictionaryPick[]>([])
const selected = ref<DictionaryPick | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let abort: AbortController | null = null

watch(
  () => props.modelValue,
  (value) => {
    if (value !== query.value) query.value = value
  }
)

async function runSearch(term: string) {
  abort?.abort()
  abort = new AbortController()
  loading.value = true
  try {
    const params = new URLSearchParams({
      domain: props.domain,
      q: term,
      limit: String(props.limit),
    })
    const res = await fetch(`/dictionary/search?${params}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: abort.signal,
    })
    if (!res.ok) {
      results.value = []
      return
    }
    const data = await res.json()
    results.value = (data.results ?? []).map((r: any) => ({
      id: r.id,
      label: r.label,
      code: r.code,
      definition: r.definition,
      hierarchy_path: r.hierarchy_path,
      domain: r.domain,
      source: r.source,
    }))
    open.value = true
  } catch (error: any) {
    if (error?.name !== 'AbortError') results.value = []
  } finally {
    loading.value = false
  }
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  query.value = value
  emit('update:modelValue', value)
  selected.value = null
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void runSearch(value.trim())
  }, 250)
}

function pick(term: DictionaryPick) {
  selected.value = term
  query.value = term.label
  emit('update:modelValue', term.label)
  emit('select', term)
  open.value = false
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  abort?.abort()
})
</script>

<template>
  <div class="relative">
    <div class="flex items-center gap-1">
      <input
        :value="query"
        type="text"
        class="field-input w-full"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        @input="onInput"
        @focus="open = results.length > 0"
      />
      <TermDefinitionPopover
        v-if="selected || query"
        :term-id="selected?.id"
        :label="selected?.label || query"
        :definition="selected?.definition"
        :code="selected?.code"
        :hierarchy-path="selected?.hierarchy_path"
      />
    </div>
    <div
      v-if="open && (loading || results.length)"
      class="theme-surface absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md shadow-lg"
    >
      <p v-if="loading" class="px-3 py-2 text-xs text-neutral-500">Searching library…</p>
      <button
        v-for="item in results"
        :key="item.id"
        type="button"
        class="block w-full px-3 py-2 text-left hover:bg-teal-50 dark:hover:bg-teal-950/40"
        @click="pick(item)"
      >
        <span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ item.label }}</span>
        <span class="block text-[11px] text-neutral-500">
          <template v-if="item.code">{{ item.code }} · </template>
          <template v-if="item.hierarchy_path">{{ item.hierarchy_path }}</template>
          <template v-else>{{ item.source }}</template>
        </span>
        <span v-if="item.definition" class="mt-0.5 block line-clamp-2 text-[11px] text-neutral-600 dark:text-neutral-400">
          {{ item.definition }}
        </span>
      </button>
    </div>
  </div>
</template>
