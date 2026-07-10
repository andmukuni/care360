<script setup lang="ts">
const show = defineModel<boolean>('show', { required: true })

withDefaults(
  defineProps<{
    title: string
    maxWidthClass?: string
    footerAlign?: 'end' | 'center'
    disabled?: boolean
  }>(),
  {
    maxWidthClass: 'max-w-2xl',
    footerAlign: 'end',
    disabled: false,
  }
)

const emit = defineEmits<{
  save: []
}>()

function close() {
  show.value = false
}

function save() {
  emit('save')
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
        class="flex max-h-[90vh] w-full flex-col rounded-lg bg-white shadow-2xl dark:bg-neutral-900"
        :class="maxWidthClass"
        @click.stop
      >
        <div class="flex flex-shrink-0 items-center justify-between theme-card-header px-6 py-4">
          <h3 class="text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-white">{{ title }}</h3>
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

        <div class="flex-1 overflow-y-auto">
          <slot />
        </div>

        <div
          class="flex flex-shrink-0 gap-3 border-t border-neutral-200 px-6 py-4"
          :class="footerAlign === 'center' ? 'items-center justify-center' : 'justify-end'"
        >
          <button type="button" class="btn-secondary text-xs px-4 py-2" @click="close">Close</button>
          <button type="button" class="btn-primary text-xs px-4 py-2" :disabled="disabled" @click="save">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
