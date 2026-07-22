<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useConfirm } from '~/composables/useConfirm'

const { state, resolve } = useConfirm()
const cancelBtnRef = ref<HTMLButtonElement | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)

const iconWrapClass = computed(() => {
  switch (state.value.variant) {
    case 'danger':
      return 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
  }
})

const confirmBtnClass = computed(() => {
  if (state.value.variant === 'danger') return 'action-btn action-btn--danger'
  if (state.value.variant === 'warning') return 'action-btn action-btn--blue'
  return 'btn-primary'
})

watch(
  () => state.value.open,
  async (open) => {
    if (!open) return
    await nextTick()
    // Prefer cancel for destructive actions so Enter is less likely to mis-fire.
    const target =
      state.value.variant === 'danger' ? cancelBtnRef.value : confirmBtnRef.value
    target?.focus()
  }
)

function onKeydown(event: KeyboardEvent) {
  if (!state.value.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    resolve(false)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="state.open"
        class="confirm-dialog fixed inset-0 z-[10040] flex items-center justify-center p-4"
        role="presentation"
      >
        <div class="absolute inset-0 bg-black/45 backdrop-blur-[1px]" @click="resolve(false)" />

        <Transition
          appear
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-2 scale-[0.98]"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-1 scale-[0.98]"
        >
          <div
            v-if="state.open"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            class="confirm-dialog__panel relative z-10 w-full max-w-md rounded-xl modal-panel p-5 shadow-2xl sm:p-6"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                :class="iconWrapClass"
              >
                <svg
                  v-if="state.variant === 'danger' || state.variant === 'warning'"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <svg
                  v-else
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8.228 9c.549-1.165 1.76-2 3.272-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div class="min-w-0 flex-1">
                <h3
                  id="confirm-dialog-title"
                  class="text-base font-semibold text-slate-900 dark:text-neutral-100"
                >
                  {{ state.title }}
                </h3>
                <p
                  id="confirm-dialog-message"
                  class="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-600 dark:text-neutral-300"
                >
                  {{ state.message }}
                </p>
              </div>
            </div>

            <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref="cancelBtnRef"
                type="button"
                class="btn-secondary px-4 py-2 text-sm"
                @click="resolve(false)"
              >
                {{ state.cancelLabel }}
              </button>
              <button
                ref="confirmBtnRef"
                type="button"
                class="inline-flex items-center justify-center px-4 py-2 text-sm"
                :class="confirmBtnClass"
                @click="resolve(true)"
              >
                {{ state.confirmLabel }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
