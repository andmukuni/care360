<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import Spinner from '~/components/ui/Spinner.vue'
import ComingSoonWardQueueOptions from '~/components/queue/ComingSoonWardQueueOptions.vue'

type SelectedAction = 'end' | null

const show = defineModel<boolean>('show', { required: true })
const treatmentNotes = defineModel<string>('treatmentNotes', { default: '' })
const closureNotes = defineModel<string>('closureNotes', { default: '' })

const props = defineProps<{
  labLoading: boolean
  pharmacyLoading: boolean
  treatmentLoading: boolean
  triageLoading: boolean
  endLoading: boolean
}>()

const emit = defineEmits<{
  queueLab: []
  queuePharmacy: []
  queueTreatment: []
  queueTriage: []
  endEncounter: []
}>()

const backLoading = ref(false)
const selectedAction = ref<SelectedAction>(null)

const anyLoading = computed(
  () =>
    props.labLoading ||
    props.pharmacyLoading ||
    props.treatmentLoading ||
    props.triageLoading ||
    props.endLoading ||
    backLoading.value
)

watch(show, (open) => {
  if (!open) selectedAction.value = null
})

function close() {
  if (anyLoading.value) return
  selectedAction.value = null
  show.value = false
}

function handleLab() {
  if (anyLoading.value) return
  emit('queueLab')
}

function handlePharmacy() {
  if (anyLoading.value) return
  emit('queuePharmacy')
}

function handleTreatment() {
  if (anyLoading.value) return
  emit('queueTreatment')
}

function handleTriage() {
  if (anyLoading.value) return
  emit('queueTriage')
}

function selectEnd() {
  if (anyLoading.value) return
  if (selectedAction.value === 'end') {
    emit('endEncounter')
    return
  }
  selectedAction.value = 'end'
}

function handleBack() {
  if (anyLoading.value) return
  backLoading.value = true
  router.visit('/screening/queue', {
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
            <p class="mt-0.5 text-xs text-neutral-500">
              Queue to lab, pharmacy, triage, or end this encounter at screening
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
              <span class="block text-sm font-semibold text-white">Queue to Lab</span>
              <span class="block text-xs text-violet-100">Save assessment and send for investigations</span>
            </span>
          </button>

          <button
            type="button"
            class="flex w-full items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-600 px-4 py-3.5 text-left transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800"
            :disabled="anyLoading"
            :aria-busy="pharmacyLoading"
            @click="handlePharmacy"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
              <Spinner v-if="pharmacyLoading" size="md" class="text-white" />
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-white">Queue to Pharmacy</span>
              <span class="block text-xs text-emerald-100">Save assessment and send prescription to pharmacy</span>
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
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
                  Finish the visit at screening without queueing onward
                </span>
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
                placeholder="e.g. Advice only, discharged home, left before pharmacy…"
                :disabled="anyLoading"
              />
            </div>
          </div>

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
              <span class="block text-xs text-neutral-500">Return to screening queue without completing</span>
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
