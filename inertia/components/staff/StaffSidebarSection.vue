<script setup lang="ts">
import { computed } from 'vue'
import type { NavSection } from '~/composables/useStaffNav'

const props = defineProps<{
  section: NavSection
  expanded: boolean
  active: boolean
}>()

defineEmits<{
  toggle: []
}>()

const isSolo = computed(
  () => props.section.items.length === 1 && !(props.section.items[0].children?.length ?? 0)
)
</script>

<template>
  <div
    class="sidebar-section"
    :class="[
      isSolo ? 'sidebar-section--solo' : '',
      `sidebar-section--${section.id}`,
      active ? 'sidebar-section--active' : '',
    ]"
  >
    <button
      v-if="!isSolo"
      type="button"
      class="sidebar-section-toggle"
      :aria-expanded="expanded ? 'true' : 'false'"
      @click="$emit('toggle')"
    >
      <span class="sidebar-section-toggle__label">{{ section.label }}</span>
      <svg
        class="sidebar-section-toggle__chevron"
        :class="expanded ? 'sidebar-section-toggle__chevron--open' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-show="isSolo || expanded" class="sidebar-section__items">
      <slot />
    </div>
  </div>
</template>
