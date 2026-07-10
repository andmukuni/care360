<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppLogo from '~/components/AppLogo.vue'
import Spinner from '~/components/ui/Spinner.vue'
import StaffNavGroup from '~/components/staff/StaffNavGroup.vue'
import StaffSidebarSection from '~/components/staff/StaffSidebarSection.vue'
import {
  loadExpandedSections,
  saveExpandedSections,
  useStaffNav,
  type CycleNavItem,
  type NavItem,
} from '~/composables/useStaffNav'
import { useNavigationLoading } from '~/composables/useNavigationLoading'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)

const {
  canSee,
  isActive,
  stageBadge,
  stageBadgeColors,
  isRegistrationClerk,
  navSections,
  settingsNavItem,
  currentPath,
  itemIsActive,
  itemIsHighlighted,
  sectionIsActive,
  activeTextForStage,
  activeTextForItem,
} = useStaffNav()

const navEl = ref<HTMLElement | null>(null)
const expandedSections = ref<Set<string>>(loadExpandedSections())
const mobileMode = ref(false)
const { isNavigatingTo, markPending } = useNavigationLoading()

function isCycleItem(item: NavItem): item is CycleNavItem {
  return 'stage' in item
}

function cycleStage(item: NavItem): string | null | undefined {
  return isCycleItem(item) ? item.stage : undefined
}

function itemKey(item: NavItem): string {
  return item.href === '#' ? item.label : item.href
}

function isSectionExpanded(sectionId: string): boolean {
  return expandedSections.value.has(sectionId)
}

function toggleSection(sectionId: string) {
  const next = new Set(expandedSections.value)
  if (next.has(sectionId)) {
    next.delete(sectionId)
  } else {
    next.add(sectionId)
  }
  expandedSections.value = next
  saveExpandedSections(next)
}

function labCycleActive(item: NavItem): boolean {
  return Boolean(item.labCycle && isActive(item.match, item.href))
}

function badgeForItem(item: NavItem): number | undefined {
  const stage = cycleStage(item)
  if (stage) {
    const count = stageBadge(stage)
    return count > 0 ? count : undefined
  }
  return item.badgeCount && item.badgeCount > 0 ? item.badgeCount : undefined
}

function badgeClassForItem(item: NavItem): string | undefined {
  const stage = cycleStage(item)
  if (stage) return stageBadgeColors[stage]
  return undefined
}

function activeTextForNavItem(item: NavItem): string {
  const stage = cycleStage(item)
  if (stage !== undefined) {
    return activeTextForStage(stage)
  }
  return activeTextForItem(item)
}

function scrollActiveIntoView() {
  const nav = navEl.value
  if (!nav) return
  const activeEl = nav.querySelector('[data-active="true"]')
  activeEl?.scrollIntoView({ block: 'nearest' })
}

function updateMobileMode() {
  mobileMode.value = window.matchMedia('(max-width: 1023px)').matches
}

onMounted(() => {
  updateMobileMode()
  window.addEventListener('resize', updateMobileMode)

  const nav = navEl.value
  if (!nav) return

  const scrollKey = 'sidebar-scroll-top'
  const saved = sessionStorage.getItem(scrollKey)
  if (saved) {
    const y = parseInt(saved, 10)
    if (!Number.isNaN(y)) nav.scrollTop = y
  }

  let t: ReturnType<typeof setTimeout> | null = null
  nav.addEventListener(
    'scroll',
    () => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        t = null
        try {
          sessionStorage.setItem(scrollKey, String(nav.scrollTop))
        } catch {
          /* ignore */
        }
      }, 200)
    },
    { passive: true }
  )

  requestAnimationFrame(scrollActiveIntoView)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobileMode)
})

watch(
  () => currentPath.value,
  () => {
    requestAnimationFrame(scrollActiveIntoView)
  }
)
</script>

<template>
  <aside
    id="sidebar"
    class="fixed lg:static inset-y-0 left-0 z-40 w-80 flex flex-col flex-shrink-0 border-r border-neutral-300 overflow-hidden transition-transform duration-300 ease-in-out"
    :class="open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
  >
    <div class="staff-sidebar__header">
      <div class="staff-sidebar__header-accent" aria-hidden="true" />
      <div class="staff-sidebar__header-inner">
        <div class="flex min-w-0 items-center gap-3">
          <AppLogo size="md" class="flex-shrink-0" />
          <div class="min-w-0">
            <p class="staff-sidebar__brand-name truncate">{{ clinicName }}</p>
            <p class="staff-sidebar__brand-version">v1.0.0</p>
          </div>
        </div>
        <button
          type="button"
          class="lg:hidden shrink-0 text-neutral-500 transition hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <nav
      ref="navEl"
      id="sidebar-nav"
      class="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overscroll-y-contain"
    >
      <StaffSidebarSection
        v-for="section in navSections"
        :key="section.id"
        :section="section"
        :expanded="isSectionExpanded(section.id)"
        :active="sectionIsActive(section)"
        @toggle="toggleSection(section.id)"
      >
        <div
          v-if="
            section.id === 'encounter-cycle' &&
            isRegistrationClerk &&
            (canSee(['patients.read', 'patients.write']) ||
              canSee(['households.read', 'households.write', 'registration.manage-households']))
          "
          class="mb-2 grid grid-cols-2 gap-2"
        >
          <Link
            v-if="canSee(['patients.read', 'patients.write'])"
            href="/patients/create"
            class="cta-add-patient flex items-center justify-center gap-2 rounded px-2 py-2.5 font-semibold whitespace-nowrap border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
            @click="markPending('/patients/create')"
          >
            <Spinner v-if="isNavigatingTo('/patients/create')" size="sm" class="text-neutral-600" aria-hidden="true" />
            <svg v-else class="default-icon w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span class="default-text">Add Patient</span>
          </Link>
          <Link
            v-if="canSee(['households.read', 'households.write', 'registration.manage-households'])"
            href="/households/create"
            class="cta-add-patient flex items-center justify-center gap-2 rounded px-2 py-2.5 font-semibold whitespace-nowrap border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
            @click="markPending('/households/create')"
          >
            <Spinner v-if="isNavigatingTo('/households/create')" size="sm" class="text-neutral-600" aria-hidden="true" />
            <svg v-else class="default-icon w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 12h18M3 17h18M7 7v10m5-10v10m5-10v10" />
            </svg>
            <span class="default-text">Add Household</span>
          </Link>
        </div>

        <StaffNavGroup
          v-for="item in section.items"
          :key="itemKey(item)"
          :item="item"
          :active="itemIsActive(item)"
          :highlighted="itemIsHighlighted(item)"
          :active-text="activeTextForNavItem(item)"
          :badge-count="badgeForItem(item)"
          :badge-class="badgeClassForItem(item)"
          :compact="section.id === 'encounter-cycle'"
          :stage="cycleStage(item)"
          :is-active="itemIsActive"
          :lab-cycle-active="labCycleActive"
          :mobile-mode="mobileMode"
        />
      </StaffSidebarSection>
    </nav>

    <div v-if="settingsNavItem" class="staff-sidebar__footer staff-sidebar__footer--settings">
      <StaffNavGroup
        :item="settingsNavItem"
        :active="itemIsActive(settingsNavItem)"
        :highlighted="itemIsHighlighted(settingsNavItem)"
        :active-text="activeTextForItem(settingsNavItem)"
        :is-active="itemIsActive"
        :lab-cycle-active="labCycleActive"
        :mobile-mode="mobileMode"
      />
    </div>

    <div class="staff-sidebar__footer staff-sidebar__footer--copyright">
      <p class="text-xs text-neutral-500 dark:text-neutral-400 text-center">&copy; {{ new Date().getFullYear() }} {{ clinicName }}</p>
    </div>
  </aside>
</template>
