<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import type { LabTestSearchResult } from '~/composables/useLabCart'

const show = defineModel<boolean>('show', { required: true })

const props = defineProps<{
  draft: {
    test_name: string
    test_code: string | null
    specimen_type: string | null
    lab_specimen_type_id: number | null
    test_group: string | null
    instructions: string | null
  }
  testSearch: string
  testResults: LabTestSearchResult[]
  testLoading: boolean
  testPopoverOpen: boolean
  testActiveIdx: number
  showError: boolean
  errorMsg: string
}>()

const emit = defineEmits<{
  'update:testSearch': [value: string]
  'update:draft': [value: typeof props.draft]
  testInput: []
  testFocus: []
  selectTest: [test: LabTestSearchResult]
  moveTestActive: [delta: number]
  pickTestActive: []
  closeTestPopover: []
  setTestActiveIdx: [idx: number]
  addToCart: []
  close: []
}>()

function patchDraft(partial: Partial<typeof props.draft>) {
  emit('update:draft', { ...props.draft, ...partial })
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-lab-test-search]')) emit('closeTestPopover')
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      @click.self="emit('close')"
    >
      <div
        class="modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg shadow-2xl"
        @click.stop
      >
        <div
          class="flex flex-shrink-0 items-center justify-between theme-card-header px-6 py-4"
        >
          <h3 class="text-base font-bold text-neutral-900 dark:text-white">Add Lab Test</h3>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="emit('close')"
          >
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-shrink-0 theme-card-header px-6 py-4" data-lab-test-search>
          <label class="field-label">Investigation <span class="text-red-500">*</span></label>
          <div class="relative">
            <input
              :value="testSearch"
              type="text"
              class="field-input pr-8"
              placeholder="Type to search lab tests…"
              autocomplete="off"
              spellcheck="false"
              @input="emit('update:testSearch', ($event.target as HTMLInputElement).value); emit('testInput')"
              @focus="emit('testFocus')"
              @keydown.arrow-down.prevent="emit('moveTestActive', 1)"
              @keydown.arrow-up.prevent="emit('moveTestActive', -1)"
              @keydown.enter.prevent="emit('pickTestActive')"
              @keydown.escape="emit('closeTestPopover')"
            />
            <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg
                v-if="testLoading"
                class="h-4 w-4 animate-spin text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <svg
                v-else
                class="h-4 w-4 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
          </div>

          <div
            v-if="testPopoverOpen && (testResults.length > 0 || testSearch.length > 0)"
            class="mt-2 max-h-52 overflow-y-auto theme-surface rounded-lg shadow-sm"
          >
            <div
              v-if="testResults.length === 0 && !testLoading"
              class="px-4 py-3.5 text-center text-sm text-neutral-400"
            >
              No tests found for "{{ testSearch }}"
            </div>
            <button
              v-for="(test, idx) in testResults"
              :key="test.id"
              type="button"
              class="block w-full border-b border-neutral-100 px-4 py-2.5 text-left last:border-0"
              :class="testActiveIdx === idx ? 'bg-neutral-100 dark:bg-neutral-700' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'"
              @mouseenter="emit('setTestActiveIdx', idx)"
              @click="emit('selectTest', test)"
            >
              <div class="text-sm font-semibold text-neutral-900 dark:text-white">{{ test.name }}</div>
              <div class="mt-0.5 text-xs text-neutral-400">
                <span v-if="test.group">{{ test.group }}</span>
                <span v-if="test.group && test.specimen"> · </span>
                <span v-if="test.specimen">{{ test.specimen }}</span>
              </div>
              <div v-if="test.definition" class="mt-0.5 line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ test.definition }}
              </div>
            </button>
          </div>

          <div
            v-if="draft.test_name"
            class="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/60 px-4 py-3 text-sm dark:border-cyan-800 dark:bg-cyan-950/20"
          >
            <p class="text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Selected</p>
            <div class="mt-1 font-semibold text-neutral-900 dark:text-white">{{ draft.test_name }}</div>
            <div v-if="draft.test_group || draft.specimen_type" class="mt-0.5 text-xs text-neutral-500">
              {{ [draft.test_group, draft.specimen_type].filter(Boolean).join(' · ') }}
            </div>
          </div>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <label class="field-label">Instructions <span class="text-xs font-normal text-neutral-400">(optional)</span></label>
            <textarea
              :value="draft.instructions ?? ''"
              rows="3"
              class="field-input"
              placeholder="Special instructions for this test…"
              @input="patchDraft({ instructions: ($event.target as HTMLTextAreaElement).value || null })"
            />
          </div>

          <div
            v-if="showError"
            class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            {{ errorMsg }}
          </div>
        </div>

        <div class="flex flex-shrink-0 justify-end gap-2 border-t border-neutral-200 px-6 py-4">
          <ActionButton type="button" variant="outline" class="!rounded !px-4 !py-2 text-sm" @click="emit('close')">
            Cancel
          </ActionButton>
          <ActionButton
            type="button"
            class="!rounded !px-4 !py-2 text-sm"
            :disabled="!draft.test_name"
            @click="emit('addToCart')"
          >
            <template #icon>
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
            Add to Request
          </ActionButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
