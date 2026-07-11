<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'

interface Column {
  key: string
  label: string
  sortable?: boolean
  class?: string
}

const props = withDefaults(
  defineProps<{
    columns: Column[]
    rows: Record<string, any>[]
    searchable?: boolean
    perPage?: number
    searchKeys?: string[]
    emptyText?: string
    rowHref?: (row: Record<string, any>) => string | null
  }>(),
  {
    searchable: true,
    perPage: 15,
    emptyText: 'No records found.',
  }
)

const search = ref('')
const page = ref(1)
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

const keys = computed(() => props.searchKeys ?? props.columns.map((c) => c.key))

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  let out = props.rows
  if (term) {
    out = out.filter((row) =>
      keys.value.some((k) => String(row[k] ?? '').toLowerCase().includes(term))
    )
  }
  if (sortKey.value) {
    const key = sortKey.value
    out = [...out].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortDir.value === 'asc' ? -1 : 1
      if (av > bv) return sortDir.value === 'asc' ? 1 : -1
      return 0
    })
  }
  return out
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / props.perPage)))
const paged = computed(() => {
  const start = (page.value - 1) * props.perPage
  return filtered.value.slice(start, start + props.perPage)
})

function toggleSort(col: Column) {
  if (col.sortable === false) return
  if (sortKey.value === col.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col.key
    sortDir.value = 'asc'
  }
}

function openRow(row: Record<string, any>, event: MouseEvent) {
  if (!props.rowHref) return

  const href = props.rowHref(row)
  if (!href) return

  const target = event.target as HTMLElement
  if (target.closest('a, button, input, select, textarea, label')) return

  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    window.open(href, '_blank')
    return
  }

  router.visit(href)
}
</script>

<template>
  <div>
    <div v-if="searchable" class="mb-3 flex items-center justify-between gap-2">
      <input
        v-model="search"
        type="search"
        placeholder="Search…"
        class="theme-field w-64 rounded px-3 py-1.5 text-sm placeholder:text-neutral-400"
        @input="page = 1"
      />
      <slot name="toolbar" />
    </div>

    <div class="data-table-shell theme-surface overflow-x-auto rounded-lg">
      <table class="w-full text-sm">
        <thead>
          <tr class="theme-card-header border-b text-left text-sand-11 dark:text-neutral-400">
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-3 py-2 font-medium"
              :class="[col.class, col.sortable !== false ? 'cursor-pointer select-none' : '']"
              @click="toggleSort(col)"
            >
              {{ col.label }}
              <span v-if="sortKey === col.key">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th v-if="$slots.actions" class="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in paged"
            :key="i"
            class="border-b border-sand-4 text-neutral-800 dark:border-white/[0.03] dark:text-neutral-200"
            :class="
              rowHref
                ? 'cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                : 'hover:bg-sand-2 dark:hover:bg-neutral-800/60'
            "
            @click="openRow(row, $event)"
          >
            <td v-for="col in columns" :key="col.key" class="px-3 py-2" :class="col.class">
              <slot :name="`cell:${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
            <td v-if="$slots.actions" class="px-3 py-2 text-right">
              <slot name="actions" :row="row" />
            </td>
          </tr>
          <tr v-if="!paged.length">
            <td
              :colspan="columns.length + ($slots.actions ? 1 : 0)"
              class="px-3 py-6 text-center text-sand-11 dark:text-neutral-500"
            >
              {{ emptyText }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="mt-3 flex items-center justify-between text-sm text-sand-11 dark:text-neutral-400">
      <span>{{ filtered.length }} records</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="theme-icon-btn rounded px-2 py-1 text-neutral-700 disabled:opacity-50 dark:text-neutral-300"
          :disabled="page <= 1"
          @click="page--"
        >
          Prev
        </button>
        <span class="text-neutral-700 dark:text-neutral-300">Page {{ page }} / {{ totalPages }}</span>
        <button
          type="button"
          class="theme-icon-btn rounded px-2 py-1 text-neutral-700 disabled:opacity-50 dark:text-neutral-300"
          :disabled="page >= totalPages"
          @click="page++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
