<script setup lang="ts">
import { computed, ref } from 'vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import type { PrescriptionCartItem } from '~/composables/usePrescriptionCart'

export type PrescriptionSuggestionGroup = {
  id: number
  items: Array<Record<string, unknown>>
  source?: {
    test_name?: string | null
    result?: string | null
    trigger?: string | null
  }
}

const props = withDefaults(
  defineProps<{
    suggestions?: PrescriptionSuggestionGroup[]
    disabled?: boolean
  }>(),
  {
    suggestions: () => [],
    disabled: false,
  }
)

const emit = defineEmits<{
  addItems: [items: PrescriptionCartItem[]]
}>()

const dismissed = ref<Set<number>>(new Set())

const visible = computed(() => props.suggestions.filter((s) => !dismissed.value.has(s.id)))

const flatItems = computed(() =>
  visible.value.flatMap((group) =>
    group.items.map((item, idx) => ({
      groupId: group.id,
      rowKey: `${group.id}-${idx}`,
      source: group.source,
      item,
    }))
  )
)

function toCartItem(raw: Record<string, unknown>): PrescriptionCartItem {
  return {
    drug_name: String(raw.drug_name ?? ''),
    formulation: String(raw.formulation ?? ''),
    dose: String(raw.dose ?? ''),
    item_per_dose: Number(raw.item_per_dose ?? 1) || 1,
    frequency: raw.frequency ?? '',
    time_per: String(raw.time_per ?? ''),
    frequency_unit: String(raw.frequency_unit ?? ''),
    duration: raw.duration ?? '',
    duration_unit: String(raw.duration_unit ?? ''),
    route: String(raw.route ?? ''),
    start_date: String(raw.start_date ?? new Date().toISOString().slice(0, 10)),
    end_date: String(raw.end_date ?? ''),
    quantity_prescribed: raw.quantity_prescribed ?? '',
    is_passer_by: '0',
    instructions: String(raw.instructions ?? ''),
  }
}

function sourceLabel(source: PrescriptionSuggestionGroup['source']) {
  if (source?.test_name) {
    return `${source.test_name}${source.result ? ` · ${source.result}` : ''}`
  }
  if (source?.trigger) return `Trigger: ${source.trigger}`
  return 'Clinical rule'
}

function addGroup(group: PrescriptionSuggestionGroup) {
  emit(
    'addItems',
    group.items.map((item) => toCartItem(item))
  )
  dismissed.value = new Set([...dismissed.value, group.id])
}

function addAll() {
  const items = visible.value.flatMap((g) => g.items.map((item) => toCartItem(item)))
  emit('addItems', items)
  dismissed.value = new Set([...dismissed.value, ...visible.value.map((g) => g.id)])
}

function addOne(raw: Record<string, unknown>, groupId: number) {
  emit('addItems', [toCartItem(raw)])
  dismissed.value = new Set([...dismissed.value, groupId])
}

function dismissGroup(id: number) {
  dismissed.value = new Set([...dismissed.value, id])
}
</script>

<template>
  <div
    v-if="flatItems.length && !disabled"
    class="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
  >
    <div class="flex items-center justify-between border-b border-emerald-200 px-4 py-2.5 dark:border-emerald-900">
      <div>
        <p class="text-xs font-bold text-emerald-900 dark:text-emerald-200">Suggested prescriptions</p>
        <p class="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">Based on lab results — review before adding</p>
      </div>
      <ActionButton type="button" class="!rounded !px-3 !py-1.5 text-xs" @click="addAll">
        Add all
      </ActionButton>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-emerald-100/60 text-[10px] uppercase dark:bg-emerald-950/40">
          <tr>
            <th class="px-3 py-2 text-left font-bold text-neutral-600">Drug</th>
            <th class="px-3 py-2 text-left font-bold text-neutral-600">Dose</th>
            <th class="px-3 py-2 text-left font-bold text-neutral-600">Frequency</th>
            <th class="px-3 py-2 text-left font-bold text-neutral-600">Duration</th>
            <th class="px-3 py-2 text-left font-bold text-neutral-600">Source</th>
            <th class="px-3 py-2 text-right font-bold text-neutral-600">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in flatItems"
            :key="row.rowKey"
            class="border-t border-emerald-100 dark:border-emerald-900/50"
          >
            <td class="px-3 py-2 text-xs font-medium">{{ row.item.drug_name || '—' }}</td>
            <td class="px-3 py-2 text-xs text-neutral-600">{{ row.item.dose || '—' }}</td>
            <td class="px-3 py-2 text-xs text-neutral-600">{{ row.item.frequency || row.item.frequency_unit || '—' }}</td>
            <td class="px-3 py-2 text-xs text-neutral-600">
              {{ [row.item.duration, row.item.duration_unit].filter(Boolean).join(' ') || '—' }}
            </td>
            <td class="px-3 py-2 text-[10px] text-neutral-500">{{ sourceLabel(row.source) }}</td>
            <td class="px-3 py-2 text-right">
              <button
                type="button"
                class="mr-2 text-[10px] font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                @click="addOne(row.item, row.groupId)"
              >
                Add
              </button>
              <button
                type="button"
                class="text-[10px] text-neutral-400 hover:text-neutral-600"
                @click="dismissGroup(row.groupId)"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
