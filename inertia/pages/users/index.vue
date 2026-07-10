<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import UserAvatar from '~/components/staff/users/UserAvatar.vue'

interface UserRow {
  id: number
  name: string
  raw_name: string
  title: string | null
  email: string
  specialty: string | null
  is_portal_bookable: boolean
  profile_photo_url: string | null
  roles: string[]
  created_at: string | null
  is_self: boolean
}

interface StaffKpis {
  total: number
  portalBookable: number
  withPhoto: number
  withRoles: number
  withSpecialty: number
  portalReady: number
  joinedThisMonth: number
}

interface KpiCard {
  key: string
  label: string
  value: number
  meta: string
  percent: number
  tone: 'slate' | 'teal' | 'violet' | 'amber'
  icon: 'users' | 'portal' | 'roles' | 'ready'
}

const props = defineProps<{
  users: UserRow[]
  kpis: StaffKpis
  roles: string[]
  canManageRoles: boolean
  canManagePortal: boolean
}>()

const columns = [
  { key: 'name', label: 'Staff Member' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'roles', label: 'Roles', sortable: false },
  { key: 'created_at', label: 'Joined' },
]

const fieldClass =
  'theme-field users-page__filter-field w-full rounded px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filters = reactive({
  search: '',
  role: '',
  portal: '' as '' | 'visible' | 'hidden',
  photo: '' as '' | 'with' | 'missing',
  roleCoverage: '' as '' | 'assigned' | 'unassigned',
})

const portalOptions = [
  { value: '', label: 'All portal states' },
  { value: 'visible', label: 'On patient portal' },
  { value: 'hidden', label: 'Hidden from portal' },
] as const

const photoOptions = [
  { value: '', label: 'All photo states' },
  { value: 'with', label: 'With profile photo' },
  { value: 'missing', label: 'Missing profile photo' },
] as const

const roleCoverageOptions = [
  { value: '', label: 'All role states' },
  { value: 'assigned', label: 'Has roles' },
  { value: 'unassigned', label: 'No role assigned' },
] as const

const hasFilters = computed(() =>
  Boolean(
    filters.search.trim() ||
      filters.role ||
      filters.portal ||
      filters.photo ||
      filters.roleCoverage
  )
)

const filteredUsers = computed(() => {
  const term = filters.search.trim().toLowerCase()
  return props.users.filter((user) => {
    if (term) {
      const haystack = [
        user.name,
        user.raw_name,
        user.email,
        user.specialty ?? '',
        ...user.roles,
      ]
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(term)) return false
    }

    if (filters.role && !user.roles.includes(filters.role)) return false
    if (filters.portal === 'visible' && !user.is_portal_bookable) return false
    if (filters.portal === 'hidden' && user.is_portal_bookable) return false
    if (filters.photo === 'with' && !user.profile_photo_url) return false
    if (filters.photo === 'missing' && user.profile_photo_url) return false
    if (filters.roleCoverage === 'assigned' && user.roles.length === 0) return false
    if (filters.roleCoverage === 'unassigned' && user.roles.length > 0) return false

    return true
  })
})

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filters; label: string }[] = []

  if (filters.search.trim()) {
    chips.push({ key: 'search', label: `Search: “${filters.search.trim()}”` })
  }
  if (filters.role) {
    chips.push({ key: 'role', label: `Role: ${filters.role}` })
  }
  if (filters.portal) {
    chips.push({
      key: 'portal',
      label: portalOptions.find((option) => option.value === filters.portal)?.label ?? filters.portal,
    })
  }
  if (filters.photo) {
    chips.push({
      key: 'photo',
      label: photoOptions.find((option) => option.value === filters.photo)?.label ?? filters.photo,
    })
  }
  if (filters.roleCoverage) {
    chips.push({
      key: 'roleCoverage',
      label:
        roleCoverageOptions.find((option) => option.value === filters.roleCoverage)?.label ??
        filters.roleCoverage,
    })
  }

  return chips
})

function clearFilters() {
  filters.search = ''
  filters.role = ''
  filters.portal = ''
  filters.photo = ''
  filters.roleCoverage = ''
}

function removeFilter(key: keyof typeof filters) {
  filters[key] = '' as never
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

const kpiCards = computed((): KpiCard[] => {
  const total = props.kpis.total
  const hiddenFromPortal = total - props.kpis.portalBookable
  const withoutRoles = total - props.kpis.withRoles
  const missingPhotos = total - props.kpis.withPhoto
  const portalReadyGap = props.kpis.portalBookable - props.kpis.portalReady

  return [
    {
      key: 'total',
      label: 'Total staff',
      value: total,
      meta:
        props.kpis.joinedThisMonth > 0
          ? `${props.kpis.joinedThisMonth} joined this month`
          : 'All active staff accounts',
      percent: 100,
      tone: 'slate',
      icon: 'users',
    },
    {
      key: 'portal',
      label: 'Patient portal',
      value: props.kpis.portalBookable,
      meta:
        hiddenFromPortal > 0
          ? `${pct(props.kpis.portalBookable, total)}% visible · ${hiddenFromPortal} hidden`
          : `${pct(props.kpis.portalBookable, total)}% visible on portal`,
      percent: pct(props.kpis.portalBookable, total),
      tone: 'teal',
      icon: 'portal',
    },
    {
      key: 'roles',
      label: 'Roles assigned',
      value: props.kpis.withRoles,
      meta:
        withoutRoles > 0
          ? `${pct(props.kpis.withRoles, total)}% coverage · ${withoutRoles} unassigned`
          : `${pct(props.kpis.withRoles, total)}% have at least one role`,
      percent: pct(props.kpis.withRoles, total),
      tone: 'violet',
      icon: 'roles',
    },
    {
      key: 'ready',
      label: 'Portal ready',
      value: props.kpis.portalReady,
      meta:
        portalReadyGap > 0
          ? `${pct(props.kpis.portalReady, props.kpis.portalBookable || total)}% of portal staff · ${portalReadyGap} need photo or specialty`
          : 'Portal doctors with photo and specialty',
      percent:
        props.kpis.portalBookable > 0
          ? pct(props.kpis.portalReady, props.kpis.portalBookable)
          : 0,
      tone: 'amber',
      icon: 'ready',
    },
  ]
})

const showCreate = ref(false)
const createForm = useForm({ name: '', email: '', password: '', password_confirmation: '' })

function submitCreate() {
  createForm.post('/users', {
    onSuccess: () => {
      createForm.reset()
      showCreate.value = false
    },
  })
}

const rolesModalUser = ref<UserRow | null>(null)
const rolesForm = useForm<{ roles: string[] }>({ roles: [] })

function openRoles(user: UserRow) {
  rolesModalUser.value = user
  rolesForm.roles = [...user.roles]
}

function submitRoles() {
  if (!rolesModalUser.value) return
  rolesForm.put(`/users/${rolesModalUser.value.id}/roles`, {
    onSuccess: () => {
      rolesModalUser.value = null
    },
  })
}

const togglingPortal = ref<number | null>(null)

function togglePortal(user: UserRow) {
  if (togglingPortal.value === user.id) return
  togglingPortal.value = user.id
  router.put(`/users/${user.id}/portal-bookable`, {
    preserveScroll: true,
    onFinish: () => {
      togglingPortal.value = null
    },
  })
}

const deleteTarget = ref<UserRow | null>(null)

function confirmDelete(user: UserRow) {
  deleteTarget.value = user
}

function destroy() {
  if (!deleteTarget.value) return
  router.delete(`/users/${deleteTarget.value.id}`, {
    onFinish: () => {
      deleteTarget.value = null
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">Staff Management</h1>
          <p class="mt-0.5 text-sm text-sand-11">Manage staff accounts, roles, and patient portal visibility.</p>
        </div>
        <ActionButton
          v-if="canManageRoles"
          type="button"
          variant="blue"
          @click="showCreate = true"
        >
          <template #icon>
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </template>
          Add User
        </ActionButton>
      </div>
    </template>

    <div class="users-page__kpi-grid mb-5">
      <div
        v-for="card in kpiCards"
        :key="card.key"
        class="users-page__kpi-card"
        :class="`users-page__kpi-card--${card.tone}`"
      >
        <div class="users-page__kpi-head">
          <div class="users-page__kpi-icon" aria-hidden="true">
            <svg v-if="card.icon === 'users'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else-if="card.icon === 'portal'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg v-else-if="card.icon === 'roles'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="users-page__kpi-label">{{ card.label }}</p>
        </div>
        <p class="users-page__kpi-value">{{ card.value }}</p>
        <p class="users-page__kpi-meta">{{ card.meta }}</p>
        <div v-if="card.key !== 'total'" class="users-page__kpi-bar" role="presentation">
          <span class="users-page__kpi-bar-fill" :style="{ width: `${card.percent}%` }" />
        </div>
      </div>
    </div>

    <div class="users-page__filters card mb-3 p-3">
      <div class="users-page__filters-row">
        <div class="users-page__filters-field users-page__filters-field--search relative">
          <svg
            class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="filters.search"
            type="search"
            placeholder="Search name, email, specialty, role…"
            :class="[fieldClass, 'pl-8']"
            aria-label="Search staff"
          />
        </div>

        <div class="users-page__filters-field">
          <select v-model="filters.role" :class="fieldClass" aria-label="Filter by role">
            <option value="">All roles</option>
            <option v-for="role in props.roles" :key="role" :value="role">{{ role }}</option>
          </select>
        </div>

        <div class="users-page__filters-field">
          <select v-model="filters.portal" :class="fieldClass" aria-label="Filter by portal visibility">
            <option v-for="option in portalOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="users-page__filters-field">
          <select v-model="filters.photo" :class="fieldClass" aria-label="Filter by profile photo">
            <option v-for="option in photoOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="users-page__filters-field">
          <select v-model="filters.roleCoverage" :class="fieldClass" aria-label="Filter by role assignment">
            <option v-for="option in roleCoverageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="users-page__filter-count">
            Showing {{ filteredUsers.length }} of {{ props.users.length }} staff
          </span>
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            class="users-page__filter-chip"
            @click="removeFilter(chip.key)"
          >
            {{ chip.label }}
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <button
          v-if="hasFilters"
          type="button"
          class="users-page__filter-clear"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredUsers"
      :searchable="false"
      empty-text="No staff members match the current filters."
    >
      <template #cell:name="{ row }">
        <div class="flex items-center gap-3">
          <UserAvatar :name="row.raw_name" :photo-url="row.profile_photo_url" size="sm" />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <Link :href="`/users/${row.id}`" class="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                {{ row.name }}
              </Link>
              <span
                v-if="row.is_self"
                class="rounded bg-sand-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand-11"
              >
                you
              </span>
              <span
                v-if="row.is_portal_bookable"
                class="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700"
              >
                Portal
              </span>
            </div>
            <p class="truncate text-xs text-sand-11">{{ row.email }}</p>
          </div>
        </div>
      </template>

      <template #cell:specialty="{ row }">
        <span v-if="row.specialty" class="text-slate-700">{{ row.specialty }}</span>
        <span v-else class="text-sand-11">—</span>
      </template>

      <template #cell:roles="{ row }">
        <div v-if="row.roles.length" class="flex flex-wrap items-center gap-1.5">
          <span class="users-page__role-pill" :title="row.roles.join(', ')">{{ row.roles[0] }}</span>
          <span
            v-if="row.roles.length > 1"
            class="users-page__role-count"
            :title="`${row.roles.length} roles assigned`"
          >
            +{{ row.roles.length - 1 }}
          </span>
        </div>
        <span v-else class="text-xs text-sand-11">No role</span>
      </template>

      <template #cell:created_at="{ row }">
        <span class="text-xs text-sand-11">{{ row.created_at ?? '—' }}</span>
      </template>

      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-0.5">
          <button
            v-if="canManagePortal"
            type="button"
            class="users-page__icon-btn"
            :class="row.is_portal_bookable ? 'users-page__icon-btn--portal-active' : ''"
            :disabled="togglingPortal === row.id"
            :title="row.is_portal_bookable ? 'Visible on patient portal — click to hide' : 'Hidden from patient portal — click to show'"
            @click="togglePortal(row)"
          >
            <svg
              v-if="togglingPortal !== row.id && row.is_portal_bookable"
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg
              v-else-if="togglingPortal !== row.id"
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            <svg v-else class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </button>

          <button
            v-if="canManageRoles"
            type="button"
            class="users-page__icon-btn"
            title="Assign roles"
            @click="openRoles(row)"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 2l2.4 1.2 2.7-.3.9 2.6 2.1 1.7-1.3 2.4.4 2.7-2.4 1.3-1.2 2.4-2.7-.4-2.4 1.3-1.7-2.1-2.6-.9.3-2.7L2 12l1.2-2.4-.3-2.7 2.6-.9L7.2 3.9l2.7.4L12 2zm0 6a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          </button>

          <Link :href="`/users/${row.id}`" class="users-page__icon-btn" title="View profile">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Link>

          <Link :href="`/users/${row.id}/edit`" class="users-page__icon-btn" title="Edit user">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>

          <button
            v-if="!row.is_self"
            type="button"
            class="users-page__icon-btn users-page__icon-btn--danger"
            title="Delete user"
            @click="confirmDelete(row)"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </template>
    </DataTable>

    <div
      v-if="showCreate"
      class="fixed inset-0 z-40 flex justify-end"
      @keydown.escape="showCreate = false"
    >
      <div class="absolute inset-0 bg-black/30 backdrop-blur-[1px]" @click="showCreate = false" />
      <div class="users-page__panel">
        <div class="users-page__panel-header">
          <div>
            <h2 class="text-sm font-semibold text-slate-900 dark:text-neutral-100">Add User</h2>
            <p class="mt-0.5 text-xs text-sand-11">Create a new staff account with default access.</p>
          </div>
          <button type="button" class="users-page__icon-btn" title="Close" @click="showCreate = false">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form class="flex flex-1 flex-col overflow-hidden" @submit.prevent="submitCreate">
          <div class="users-page__panel-body space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium">Name</label>
              <input v-model="createForm.name" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="createForm.errors.name" class="mt-1 text-sm text-red-600">{{ createForm.errors.name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Email</label>
              <input v-model="createForm.email" type="email" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="createForm.errors.email" class="mt-1 text-sm text-red-600">{{ createForm.errors.email }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Password</label>
              <input v-model="createForm.password" type="password" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="createForm.errors.password" class="mt-1 text-sm text-red-600">{{ createForm.errors.password }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Confirm Password</label>
              <input
                v-model="createForm.password_confirmation"
                type="password"
                class="theme-field w-full rounded px-3 py-2"
              />
            </div>
          </div>
          <div class="users-page__panel-footer">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showCreate = false">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="createForm.processing" loading-text="Saving…">
              Create User
            </ActionButton>
          </div>
        </form>
      </div>
    </div>

    <div v-if="rolesModalUser" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="rolesModalUser = null" />
      <div class="relative z-10 w-full max-w-lg overflow-hidden rounded-lg modal-panel shadow-2xl">
        <div class="modal-panel__header border-b px-5 py-4">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-neutral-100">Assign Roles</h2>
          <p class="mt-1 text-xs text-sand-11 dark:text-neutral-400">
            Update roles for <span class="font-semibold text-slate-700 dark:text-neutral-200">{{ rolesModalUser.name }}</span>.
          </p>
        </div>
        <form class="px-5 py-4" @submit.prevent="submitRoles">
          <div class="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            <label
              v-for="role in props.roles"
              :key="role"
              class="flex cursor-pointer items-center gap-2 rounded border border-sand-6 px-3 py-2 text-xs text-slate-700 hover:bg-sand-2 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <input v-model="rolesForm.roles" type="checkbox" :value="role" />
              {{ role }}
            </label>
          </div>
          <div class="mt-4 flex justify-end gap-2 border-t border-sand-6 pt-4">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="rolesModalUser = null">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="rolesForm.processing" loading-text="Saving…">
              Save Roles
            </ActionButton>
          </div>
        </form>
      </div>
    </div>

    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="deleteTarget = null" />
      <div class="relative z-10 w-full max-w-sm space-y-4 rounded-lg modal-panel p-6 shadow-2xl">
        <div class="flex items-start gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
            <svg class="h-4 w-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-900 dark:text-neutral-100">Delete User</h3>
            <p class="mt-1 text-sm text-sand-11 dark:text-neutral-400">
              Remove <strong class="text-slate-700 dark:text-neutral-200">{{ deleteTarget.name }}</strong>? This cannot be undone.
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="deleteTarget = null">
            Cancel
          </button>
          <ActionButton type="button" variant="danger" @click="destroy">Delete</ActionButton>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
