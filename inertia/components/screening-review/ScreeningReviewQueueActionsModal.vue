<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import Spinner from '~/components/ui/Spinner.vue'
import ComingSoonWardQueueOptions from '~/components/queue/ComingSoonWardQueueOptions.vue'

const show = defineModel<boolean>('show', { required: true })
const treatmentNotes = defineModel<string>('treatmentNotes', { default: '' })

const props = defineProps<{
  completeLoading: boolean
  labLoading: boolean
  treatmentLoading: boolean
  triageLoading: boolean
}>()

const emit = defineEmits<{
  complete: []
  queueLab: []
  queueTreatment: []
  queueTriage: []
}>()

const backLoading = ref(false)

const anyLoading = computed(
  () =>
    props.completeLoading ||
    props.labLoading ||
    props.treatmentLoading ||
    props.triageLoading ||
    backLoading.value
)

function close() {
  if (anyLoading.value) return
  show.value = false
}

function handleComplete() {
  emit('complete')
}

function handleLab() {
  emit('queueLab')
}

function handleTreatment() {
  emit('queueTreatment')
}

function handleTriage() {
  emit('queueTriage')
}

function handleBack() {
  backLoading.value = true
  router.visit('/screening-review/queue', {
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
            <h3 class="text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-white">Queue Actions</h3>
            <p class="mt-0.5 text-xs text-neutral-500">Choose where to send this patient next</p>
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
            @click="handleComplete"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
              <Spinner v-if="completeLoading" size="md" class="text-white" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-white">Save &amp; Queue to Pharmacy</span>
              <span class="block text-xs text-neutral-300">Complete review and send prescription to pharmacy</span>
            </span>
            <span v-if="completeLoading" class="inline-flex items-center gap-2 text-xs text-neutral-300">
              <Spinner size="xs" class="text-neutral-300" />
              Submitting…
            </span>
          </button>

          <button
            type="button"
            class="flex w-full items-center gap-4 rounded-lg border border-violet-200 bg-violet-600 px-4 py-3.5 text-left transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800"
            :disabled="anyLoading"
            :aria-busy="labLoading"
            @click="handleLab"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
              <Spinner v-if="labLoading" size="md" class="text-white" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-white">Queue to Lab Again</span>
              <span class="block text-xs text-violet-100">Send back for additional tests or repeat investigations</span>
            </span>
            <span v-if="labLoading" class="inline-flex items-center gap-2 text-xs text-violet-100">
              <Spinner size="xs" class="text-violet-100" />
              Queueing…
            </span>
          </button>

          <div class="space-y-2">
            <button
              type="button"
              class="flex w-full items-center gap-4 rounded-lg border border-sky-200 bg-sky-600 px-4 py-3.5 text-left transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800"
              :disabled="anyLoading"
              :aria-busy="treatmentLoading"
              @click="handleTreatment"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                <Spinner v-if="treatmentLoading" size="md" class="text-white" />
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-white">Queue to Treatment Room</span>
                <span class="block text-xs text-sky-100">Send for injections, IV, nebulisation, dressings</span>
              </span>
              <span v-if="treatmentLoading" class="inline-flex items-center gap-2 text-xs text-sky-100">
                <Spinner size="xs" class="text-sky-100" />
                Queueing…
              </span>
            </button>

            <div class="ml-14">
              <label class="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Handover notes <span class="font-normal text-neutral-400">(optional)</span>
              </label>
              <textarea
                v-model="treatmentNotes"
                rows="2"
                maxlength="500"
                class="field-input text-sm"
                placeholder="Anything the treatment room should know…"
                :disabled="anyLoading"
              />
            </div>
          </div>

          <button
            type="button"
            class="theme-surface flex w-full items-center gap-4 rounded-lg px-4 py-3.5 text-left transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800/60"
            :disabled="anyLoading"
            :aria-busy="triageLoading"
            @click="handleTriage"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Spinner v-if="triageLoading" size="md" class="text-amber-700 dark:text-amber-300" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-neutral-900 dark:text-white">Return to Triage</span>
              <span class="block text-xs text-neutral-500">Send back for vitals recheck</span>
            </span>
            <span v-if="triageLoading" class="inline-flex items-center gap-2 text-xs text-neutral-500">
              <Spinner size="xs" />
              Returning…
            </span>
          </button>

          <ComingSoonWardQueueOptions />

          <button
            type="button"
            class="theme-surface flex w-full items-center gap-4 rounded-lg px-4 py-3.5 text-left transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50/50 dark:hover:bg-neutral-800"
            :disabled="anyLoading"
            :aria-busy="backLoading"
            @click="handleBack"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
              <Spinner v-if="backLoading" size="md" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-neutral-900 dark:text-white">Back to Queue</span>
              <span class="block text-xs text-neutral-500">Return to screening review queue without completing</span>
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
