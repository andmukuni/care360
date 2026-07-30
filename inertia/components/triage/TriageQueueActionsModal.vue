<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import Spinner from '~/components/ui/Spinner.vue'
import ComingSoonWardQueueOptions from '~/components/queue/ComingSoonWardQueueOptions.vue'

type SelectedAction = 'queue' | 'end' | null

const show = defineModel<boolean>('show', { required: true })
const closureNotes = defineModel<string>('closureNotes', { default: '' })

const props = defineProps<{
  completeLoading: boolean
  endLoading: boolean
}>()

const emit = defineEmits<{
  complete: []
  endEncounter: []
}>()

const backLoading = ref(false)
const selectedAction = ref<SelectedAction>(null)

const anyLoading = computed(
  () => props.completeLoading || props.endLoading || backLoading.value
)

watch(show, (open) => {
  if (!open) selectedAction.value = null
})

function close() {
  if (anyLoading.value) return
  selectedAction.value = null
  show.value = false
}

function selectQueue() {
  if (anyLoading.value) return
  emit('complete')
  close()
}

function selectEnd() {
  if (anyLoading.value) return
  if (selectedAction.value === 'end') {
    emit('endEncounter')
    return
  }
  selectedAction.value = 'end'
}

function backToQueue() {
  if (anyLoading.value) return
  backLoading.value = true
  router.visit('/triage/queue', {
    onFinish: () => {
      backLoading.value = false
    },
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      @click.self="close"
    >
      <div
        class="modal-panel relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl shadow-2xl"
        @click.stop
      >
        <div class="flex items-center justify-between theme-card-header px-6 py-4">
          <div>
            <h3 class="text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-white">
              Queue Actions
            </h3>
            <p class="mt-0.5 text-xs text-neutral-500">
              Queue to screening or end this encounter at triage
            </p>
          </div>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-800"
            :disabled="anyLoading"
            @click="close"
          >
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-2 overflow-y-auto p-4">
          <button
            type="button"
            class="flex w-full items-center gap-4 rounded-lg border border-neutral-200 bg-neutral-900 px-4 py-3.5 text-left transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="anyLoading"
            :aria-busy="completeLoading"
            @click="selectQueue"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
              <Spinner v-if="completeLoading" size="md" class="text-white" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-white">Save &amp; Queue to Screening</span>
              <span class="block text-xs text-neutral-300">
                Save vitals and send patient to screening queue
              </span>
            </span>
            <span v-if="completeLoading" class="inline-flex items-center gap-2 text-xs text-neutral-300">
              <Spinner size="xs" class="text-neutral-300" />
              Submitting…
            </span>
          </button>

          <div class="space-y-2">
            <button
              type="button"
              class="flex w-full items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
              :class="
                selectedAction === 'end'
                  ? 'border-red-200 bg-red-600 hover:bg-red-700 dark:border-red-800'
                  : 'theme-surface hover:bg-neutral-50 dark:hover:bg-neutral-800'
              "
              :disabled="anyLoading"
              :aria-busy="endLoading"
              @click="selectEnd"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                :class="
                  selectedAction === 'end'
                    ? 'bg-white/15 text-white'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                "
              >
                <Spinner
                  v-if="endLoading"
                  size="md"
                  :class="selectedAction === 'end' ? 'text-white' : 'text-red-700 dark:text-red-300'"
                />
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block text-sm font-semibold"
                  :class="selectedAction === 'end' ? 'text-white' : 'text-neutral-900 dark:text-white'"
                >
                  {{ selectedAction === 'end' ? 'Confirm end encounter' : 'End encounter' }}
                </span>
                <span
                  class="block text-xs"
                  :class="selectedAction === 'end' ? 'text-red-100' : 'text-neutral-500'"
                >
                  Finish the visit at triage without queueing to screening
                </span>
              </span>
              <span
                v-if="endLoading"
                class="inline-flex items-center gap-2 text-xs text-red-100"
              >
                <Spinner size="xs" class="text-red-100" />
                Ending…
              </span>
            </button>

            <div v-if="selectedAction === 'end'" class="ml-14">
              <label class="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Closure notes <span class="font-normal text-neutral-400">(optional)</span>
              </label>
              <textarea
                v-model="closureNotes"
                rows="2"
                maxlength="2000"
                class="field-input text-sm"
                placeholder="e.g. Advice given, left before screening, vitals only…"
                :disabled="anyLoading"
              />
            </div>
          </div>

          <ComingSoonWardQueueOptions />

          <button
            type="button"
            class="theme-surface flex w-full items-center gap-4 rounded-lg px-4 py-3.5 text-left transition hover:bg-neutral-100/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800"
            :disabled="anyLoading"
            :aria-busy="backLoading"
            @click="backToQueue"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
            >
              <Spinner v-if="backLoading" size="md" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-neutral-900 dark:text-white">Back to Queue</span>
              <span class="block text-xs text-neutral-500">
                Return to triage queue without completing
              </span>
            </span>
            <span v-if="backLoading" class="inline-flex items-center gap-2 text-xs text-neutral-500">
              <Spinner size="xs" />
              Leaving…
            </span>
          </button>
        </div>

        <div class="flex justify-end border-t border-neutral-200 px-6 py-3">
          <ActionButton variant="outline" class="!px-4 !py-2 text-xs" :disabled="anyLoading" @click="close">
            Cancel
          </ActionButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
