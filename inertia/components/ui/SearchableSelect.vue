<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    options: readonly string[]
    placeholder?: string
    disabled?: boolean
    searchPlaceholder?: string
  }>(),
  {
    placeholder: 'Search',
    disabled: false,
    searchPlaceholder: 'Type to search…',
  }
)

const emit = defineEmits<{
  change: [value: string]
}>()

const open = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const rootRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((opt) => opt.toLowerCase().includes(q))
})

function toggle() {
  if (props.disabled) return
  open.value ? close() : openMenu()
}

function openMenu() {
  if (props.disabled) return
  open.value = true
  query.value = ''
  activeIndex.value = props.options.findIndex((o) => o === model.value)
  nextTick(() => searchRef.value?.focus())
}

function close() {
  open.value = false
  query.value = ''
  activeIndex.value = -1
}

function select(value: string) {
  model.value = value
  emit('change', value)
  close()
}

function clear() {
  select('')
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault()
      openMenu()
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const choice = filtered.value[activeIndex.value]
    if (choice !== undefined) select(choice)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) close()
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('mousedown', onDocumentClick)
  else document.removeEventListener('mousedown', onDocumentClick)
})
</script>

<template>
  <div ref="rootRef" class="searchable-select relative">
    <button
      type="button"
      class="field-input flex w-full items-center justify-between gap-2 text-left"
      :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
      :disabled="disabled"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span :class="model ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'">
        {{ model || placeholder }}
      </span>
      <svg
        class="h-4 w-4 shrink-0 text-neutral-400 transition-transform"
        :class="open ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute z-50 mt-1 w-full overflow-hidden theme-surface rounded-lg shadow-lg"
    >
      <div class="border-b border-neutral-100 p-2">
        <input
          ref="searchRef"
          v-model="query"
          type="text"
          class="field-input !py-1.5 text-sm"
          :placeholder="searchPlaceholder"
          @keydown="onKeydown"
        />
      </div>

      <div class="max-h-56 overflow-y-auto py-1">
        <button
          v-if="model"
          type="button"
          class="block w-full px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          @click="clear"
        >
          Clear selection
        </button>

        <button
          v-for="(opt, idx) in filtered"
          :key="opt"
          type="button"
          class="block w-full px-3 py-2 text-left text-sm transition"
          :class="[
            idx === activeIndex
              ? 'bg-neutral-100 dark:bg-neutral-700'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700',
            opt === model
              ? 'font-semibold text-neutral-900 dark:text-white'
              : 'text-neutral-700 dark:text-neutral-200',
          ]"
          @click="select(opt)"
          @mouseenter="activeIndex = idx"
        >
          {{ opt }}
        </button>

        <p v-if="!filtered.length" class="px-3 py-3 text-center text-sm text-neutral-400">
          No matches found
        </p>
      </div>
    </div>
  </div>
</template>
