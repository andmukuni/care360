<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import ComingSoonWardQueueOptions from '~/components/queue/ComingSoonWardQueueOptions.vue'

const show = defineModel<boolean>('show', { required: true })

defineProps<{
  completeLoading: boolean
}>()

const emit = defineEmits<{
  complete: []
}>()

function close() {
  show.value = false
}

function completeAndQueue() {
  emit('complete')
  close()
}

function backToQueue() {
  close()
  router.visit('/triage/queue')
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
            class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
            :disabled="completeLoading"
            @click="completeAndQueue"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-white">Save &amp; Queue to Screening</span>
              <span class="block text-xs text-neutral-300">Save vitals and send patient to screening queue</span>
            </span>
            <span v-if="completeLoading" class="text-xs text-neutral-400">Submitting…</span>
          </button>

          <ComingSoonWardQueueOptions />

          <button
            type="button"
            class="theme-surface flex w-full items-center gap-4 rounded-lg px-4 py-3.5 text-left transition hover:bg-neutral-100/50 dark:hover:bg-neutral-800"
            @click="backToQueue"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-neutral-900 dark:text-white">Back to Queue</span>
              <span class="block text-xs text-neutral-500">Return to triage queue without completing</span>
            </span>
          </button>
        </div>

        <div class="flex justify-end border-t border-neutral-200 px-6 py-3">
          <ActionButton variant="outline" class="!px-4 !py-2 text-xs" @click="close">Cancel</ActionButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
