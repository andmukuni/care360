<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Spinner from '~/components/ui/Spinner.vue'
import type { NavItem } from '~/composables/useStaffNav'
import { useNavigationLoading } from '~/composables/useNavigationLoading'

const props = defineProps<{
  item: NavItem
  active: boolean
  highlighted: boolean
  activeText: string
  badgeCount?: number
  badgeClass?: string
  compact?: boolean
  hasChildren?: boolean
  flyoutOpen?: boolean
}>()

defineEmits<{
  toggleFlyout: []
}>()

const { isNavigatingTo, markPending } = useNavigationLoading()
const loading = computed(() => isNavigatingTo(props.item.href))
</script>

<template>
  <div
    class="staff-nav-row group"
    :class="highlighted ? `is-active ${activeText}` : ''"
    :data-active="highlighted ? 'true' : undefined"
  >
    <Link
      v-if="item.href !== '#'"
      :href="item.href"
      class="staff-nav-row__link"
      :class="highlighted ? activeText : ''"
      @click="markPending(item.href)"
    >
      <Spinner
        v-if="loading && item.icon"
        :size="compact ? 'xs' : 'sm'"
        :class="highlighted ? activeText : 'text-neutral-500'"
        aria-hidden="true"
      />
      <svg
        v-else-if="item.icon"
        class="flex-shrink-0"
        :class="[
          compact ? 'h-[18px] w-[18px]' : 'h-5 w-5',
          highlighted ? activeText : 'text-neutral-500 group-hover:text-neutral-800',
        ]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="item.icon" />
      </svg>
      <span class="flex-1 truncate">{{ item.label }}</span>
      <span
        v-if="badgeCount && badgeCount > 0"
        class="staff-nav-row__badge flex items-center justify-center rounded px-1 font-bold"
        :class="badgeClass ?? 'bg-amber-500 text-white'"
      >
        {{ badgeCount }}
      </span>
    </Link>
    <span
      v-else
      class="staff-nav-row__link text-neutral-500"
    >
      <svg
        v-if="item.icon"
        class="flex-shrink-0"
        :class="compact ? 'h-[18px] w-[18px]' : 'h-5 w-5'"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="item.icon" />
      </svg>
      <span class="flex-1 truncate">{{ item.label }}</span>
    </span>

    <button
      v-if="hasChildren"
      type="button"
      class="sidebar-nav-chevron mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded transition"
      :class="
        flyoutOpen
          ? 'bg-neutral-200 text-neutral-800'
          : 'text-neutral-400 hover:bg-neutral-300 hover:text-neutral-800'
      "
      :aria-expanded="flyoutOpen ? 'true' : 'false'"
      aria-label="Open submenu"
      @click.stop="$emit('toggleFlyout')"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</template>

