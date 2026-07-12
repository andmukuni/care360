<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GlobalAutosaveIndicator from '~/components/ui/GlobalAutosaveIndicator.vue'
import { useStaffNav } from '~/composables/useStaffNav'
import { useTheme } from '~/composables/useTheme'

defineEmits<{
  openSidebar: []
}>()

const page = usePage()
const user = computed(() => (page.props as any).currentUser)
const roles = computed(() => ((page.props as any).authRoles as string[]) ?? [])
const { canManageSettings } = useStaffNav()

const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const { isDark, toggle: toggleTheme } = useTheme()
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | null = null

const initials = computed(() => {
  const name = user.value?.name ?? user.value?.email ?? 'A'
  return String(name).slice(0, 2).toUpperCase()
})

const settingsHref = computed(() => (canManageSettings.value ? '/settings' : '/dashboard'))

const roleLabel = computed(() => {
  if (!roles.value.length) return 'Staff'
  return formatRole(roles.value[0])
})

const clockLabel = computed(() =>
  now.value.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
)

function formatRole(name: string): string {
  const labels: Record<string, string> = {
    'super-admin': 'Super Admin',
    'registration-clerk': 'Registration Clerk',
    'ward-nurse': 'Ward Nurse',
  }
  return labels[name] ?? name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function onDocumentClick(e: MouseEvent) {
  const el = dropdownRef.value
  if (!el || el.contains(e.target as Node)) return
  dropdownOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 30_000)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <header class="staff-navbar">
    <div class="staff-navbar__accent" aria-hidden="true" />

    <div class="staff-navbar__inner">
      <div class="staff-navbar__left">
        <button
          type="button"
          class="staff-navbar__menu-btn lg:hidden"
          aria-label="Open navigation"
          @click="$emit('openSidebar')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <nav
          v-if="$slots.breadcrumbs"
          class="staff-navbar__trail hidden min-w-0 sm:flex"
          aria-label="Breadcrumb"
        >
          <Link href="/dashboard" class="staff-navbar__home">
            <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </Link>

          <div class="staff-navbar__crumbs">
            <slot name="breadcrumbs" />
          </div>
        </nav>

        <div v-else class="staff-navbar__brand-mark hidden sm:flex">
          <span class="staff-navbar__brand-icon" aria-hidden="true">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </span>
          <span class="staff-navbar__brand-text">Clinical Workspace</span>
        </div>
      </div>

      <div class="staff-navbar__center hidden lg:flex">
        <span class="staff-navbar__duty">
          <span class="staff-navbar__duty-dot" aria-hidden="true" />
          On duty
        </span>
        <span class="staff-navbar__clock">{{ clockLabel }}</span>
      </div>

      <div class="staff-navbar__actions">
        <GlobalAutosaveIndicator />

        <button type="button" class="staff-navbar__icon-btn relative" aria-label="Notifications">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="staff-navbar__notify-dot" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="staff-navbar__icon-btn"
          title="Toggle theme"
          aria-label="Toggle theme"
          @click="toggleTheme"
        >
          <svg v-show="!isDark" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          <svg v-show="isDark" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        <div class="staff-navbar__divider" aria-hidden="true" />

        <div ref="dropdownRef" class="relative">
          <button
            type="button"
            class="staff-navbar__user-btn"
            :aria-expanded="dropdownOpen"
            aria-haspopup="true"
            @click="toggleDropdown"
          >
            <div class="staff-navbar__avatar" :title="user?.name ?? user?.email">
              {{ initials }}
              <span class="staff-navbar__avatar-ring" aria-hidden="true" />
            </div>
            <div class="hidden text-left md:block">
              <div class="staff-navbar__user-name">{{ user?.name ?? 'Admin' }}</div>
              <div class="staff-navbar__user-role">{{ roleLabel }}</div>
            </div>
            <svg class="hidden h-4 w-4 text-neutral-400 md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div v-show="dropdownOpen" class="staff-navbar__dropdown">
            <div class="staff-navbar__dropdown-header">
              <p class="staff-navbar__dropdown-name">{{ user?.name ?? 'Admin User' }}</p>
              <p class="staff-navbar__dropdown-email">{{ user?.email ?? '' }}</p>
              <span class="staff-navbar__dropdown-role">{{ roleLabel }}</span>
            </div>
            <Link href="/profile" class="staff-navbar__dropdown-item">My Profile</Link>
            <Link :href="settingsHref" class="staff-navbar__dropdown-item">Settings</Link>
            <div class="staff-navbar__dropdown-footer">
              <Link href="/logout" method="post" as="button" class="staff-navbar__dropdown-item staff-navbar__dropdown-item--signout">
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
