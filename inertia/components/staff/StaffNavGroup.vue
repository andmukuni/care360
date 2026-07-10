<script setup lang="ts">
import { computed, ref } from 'vue'
import StaffNavFlyout from '~/components/staff/StaffNavFlyout.vue'
import StaffNavRow from '~/components/staff/StaffNavRow.vue'
import type { NavItem } from '~/composables/useStaffNav'

const props = defineProps<{
  item: NavItem
  activeText: string
  active: boolean
  highlighted: boolean
  badgeCount?: number
  badgeClass?: string
  compact?: boolean
  stage?: string | null
  isActive: (item: NavItem) => boolean
  labCycleActive: (item: NavItem) => boolean
  mobileMode?: boolean
}>()

const rowRef = ref<HTMLElement | null>(null)
const flyoutOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

const hasChildren = computed(() => (props.item.children?.length ?? 0) > 0)

function cancelCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function openFlyout() {
  if (!hasChildren.value) return
  cancelCloseTimer()
  flyoutOpen.value = true
}

function closeFlyout() {
  cancelCloseTimer()
  flyoutOpen.value = false
}

function scheduleClose() {
  if (props.mobileMode) return
  cancelCloseTimer()
  closeTimer = setTimeout(() => {
    flyoutOpen.value = false
    closeTimer = null
  }, 120)
}

function toggleFlyout() {
  if (!hasChildren.value) return
  flyoutOpen.value = !flyoutOpen.value
}

function onMouseEnter() {
  if (props.mobileMode) return
  openFlyout()
}

function onMouseLeave() {
  if (props.mobileMode) return
  scheduleClose()
}

function onFlyoutEnter() {
  if (props.mobileMode) return
  openFlyout()
}

function onFlyoutLeave() {
  if (props.mobileMode) return
  scheduleClose()
}
</script>

<template>
  <div
    ref="rowRef"
    class="staff-nav-group"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <StaffNavRow
      :item="item"
      :active="active"
      :highlighted="highlighted"
      :active-text="activeText"
      :badge-count="badgeCount"
      :badge-class="badgeClass"
      :compact="compact"
      :has-children="hasChildren"
      :flyout-open="flyoutOpen"
      @toggle-flyout="toggleFlyout"
    />

    <StaffNavFlyout
      v-if="hasChildren"
      :open="flyoutOpen"
      :anchor-el="rowRef"
      :items="item.children ?? []"
      :parent-label="item.label"
      :active-text="activeText"
      :is-active="isActive"
      :lab-cycle-active="labCycleActive"
      @close="closeFlyout"
      @pointerenter="onFlyoutEnter"
      @pointerleave="onFlyoutLeave"
    />
  </div>
</template>
