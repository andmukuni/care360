<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Spinner from '~/components/ui/Spinner.vue'
import type { NavItem } from '~/composables/useStaffNav'
import { useNavigationLoading } from '~/composables/useNavigationLoading'

const props = defineProps<{
  open: boolean
  anchorEl: HTMLElement | null
  items: NavItem[]
  parentLabel: string
  activeText: string
  isActive: (item: NavItem) => boolean
  labCycleActive: (item: NavItem) => boolean
}>()

const emit = defineEmits<{
  close: []
  pointerenter: []
  pointerleave: []
}>()

const { isNavigatingTo, markPending } = useNavigationLoading()

const panelRef = ref<HTMLElement | null>(null)
const style = ref({ top: '0px', left: '0px' })

const groupedItems = computed(() => {
  const groups: { label: string | null; items: NavItem[] }[] = []
  let currentGroup: { label: string | null; items: NavItem[] } | null = null

  for (const item of props.items) {
    const groupLabel = item.group ?? null
    if (!currentGroup || currentGroup.label !== groupLabel) {
      currentGroup = { label: groupLabel, items: [] }
      groups.push(currentGroup)
    }
    currentGroup.items.push(item)
  }

  return groups
})

function updatePosition() {
  const anchor = props.anchorEl
  const panel = panelRef.value
  if (!anchor || !panel || !props.open) return

  const rect = anchor.getBoundingClientRect()
  const panelHeight = panel.offsetHeight
  const viewportPadding = 8
  const sidebarRight = rect.right

  let top = rect.top
  if (top + panelHeight > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, window.innerHeight - viewportPadding - panelHeight)
  }

  style.value = {
    top: `${top}px`,
    left: `${sidebarRight + 4}px`,
  }
}

function childClasses(item: NavItem): string {
  const active = item.labCycle ? props.labCycleActive(item) : props.isActive(item)
  if (item.labCycle) {
    return active
      ? 'sidebar-flyout-item sidebar-flyout-item--lab-active'
      : 'sidebar-flyout-item sidebar-flyout-item--lab'
  }
  if (active) {
    return `sidebar-flyout-item sidebar-flyout-item--active ${props.activeText}`
  }
  return 'sidebar-flyout-item'
}

function onDocumentClick(event: MouseEvent) {
  if (!props.open) return
  const target = event.target as Node
  if (panelRef.value?.contains(target) || props.anchorEl?.contains(target)) return
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => [props.open, props.anchorEl, props.items.length] as const,
  () => {
    if (props.open) {
      requestAnimationFrame(updatePosition)
    }
  }
)

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelRef"
      class="sidebar-flyout"
      :style="style"
      role="menu"
      :aria-label="`${parentLabel} submenu`"
      @mouseenter="emit('pointerenter')"
      @mouseleave="emit('pointerleave')"
    >
      <p class="sidebar-flyout-title">{{ parentLabel }}</p>
      <template v-for="(group, groupIndex) in groupedItems" :key="groupIndex">
        <p v-if="group.label" class="sidebar-flyout-group-label">{{ group.label }}</p>
        <Link
          v-for="child in group.items"
          :key="child.href"
          :href="child.href"
          class="sidebar-flyout-item flex items-center gap-2.5 px-3 py-2.5 font-medium transition"
          :class="childClasses(child)"
          role="menuitem"
          @click="markPending(child.href); emit('close')"
        >
          <Spinner
            v-if="isNavigatingTo(child.href) && child.icon"
            size="sm"
            :class="child.labCycle && labCycleActive(child) ? '' : isActive(child) ? activeText : 'text-neutral-500'"
            aria-hidden="true"
          />
          <svg
            v-else-if="child.icon"
            class="h-4 w-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="child.icon" />
          </svg>
          <span class="flex-1 truncate">{{ child.label }}</span>
          <span
            v-if="child.badgeCount && child.badgeCount > 0"
            class="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded bg-amber-500 text-white"
          >
            {{ child.badgeCount }}
          </span>
        </Link>
      </template>
    </div>
  </Teleport>
</template>
