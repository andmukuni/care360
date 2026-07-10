<script setup lang="ts">
import { computed, ref } from 'vue'
import AnimatedChevronGuide from '~/components/ui/AnimatedChevronGuide.vue'
import Spinner from '~/components/ui/Spinner.vue'
import { useOffscreenVisibility } from '~/composables/useOffscreenVisibility'

const props = withDefaults(
  defineProps<{
    showHint?: boolean
    label?: string
    ariaLabel?: string
    sticky?: boolean
    loading?: boolean
    loadingText?: string
  }>(),
  {
    showHint: false,
    sticky: true,
    loading: false,
    loadingText: 'Processing…',
  }
)

const emit = defineEmits<{
  click: []
}>()

const footerRef = ref<HTMLElement | null>(null)
const { isVisible } = useOffscreenVisibility(footerRef)
const showSticky = computed(() => props.sticky !== false && !isVisible.value)

function handleClick() {
  if (props.loading) {
    return
  }
  emit('click')
}
</script>

<template>
  <button
    ref="footerRef"
    type="button"
    class="queue-footer group flex w-full items-stretch border-0 pl-6 text-left"
    :aria-label="ariaLabel ?? 'Queue patient'"
    :aria-busy="loading"
    :disabled="loading"
    @click="handleClick"
  >
    <div class="queue-footer__hint relative min-h-[52px] flex-1 self-stretch">
      <AnimatedChevronGuide v-if="showHint" />
    </div>
    <span class="queue-footer__btn btn-primary inline-flex shrink-0 items-center justify-center gap-2">
      <template v-if="loading">
        <Spinner size="sm" />
        {{ loadingText }}
      </template>
      <template v-else>
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
        {{ label ?? 'Queue' }}
      </template>
    </span>
  </button>

  <Teleport to="body">
    <button
      v-show="showSticky"
      type="button"
      class="queue-footer-sticky"
      :aria-label="ariaLabel ?? 'Queue patient'"
      :aria-busy="loading"
      :disabled="loading"
      @click="handleClick"
    >
      <span class="queue-footer-sticky__btn btn-primary inline-flex w-full max-w-3xl items-center justify-center gap-2">
        <template v-if="loading">
          <Spinner size="sm" />
          {{ loadingText }}
        </template>
        <template v-else>
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          {{ label ?? 'Queue' }}
        </template>
      </span>
    </button>
  </Teleport>
</template>

<style scoped>
.queue-footer {
  border-top: 1px solid #d4d4d4;
  background: #fafafa;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.queue-footer:hover {
  background: #f0f0f0;
}
.queue-footer:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}
.queue-footer:focus-visible {
  outline: 2px solid #171717;
  outline-offset: -2px;
}
:global(.dark) .queue-footer {
  border-top-color: #525252;
  background: #171717;
}
:global(.dark) .queue-footer:hover {
  background: #262626;
}
:global(.dark) .queue-footer:focus-visible {
  outline-color: #fafafa;
}
.queue-footer__btn {
  align-self: stretch;
  min-height: 52px;
  padding-left: 1.75rem !important;
  padding-right: 1.75rem !important;
  border-radius: 0 !important;
  border-bottom-right-radius: 0.5rem !important;
  border-left: 1px solid #d4d4d4 !important;
  pointer-events: none;
}
.queue-footer__hint {
  min-height: 52px;
  pointer-events: none;
}
:global(.dark) .queue-footer__btn {
  border-left-color: #525252 !important;
}
</style>
