<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

interface RoleRow {
  id: number
  name: string
  permissions_count: number
  users_count: number
  is_protected: boolean
}

interface AccessStats {
  roles: number
  permissions: number
  permissionGroups: number
  assignedStaff: number
}

const props = withDefaults(
  defineProps<{
    roleRows: RoleRow[]
    rolePermissions: Record<number, string[]>
    permissionGroups: Record<string, { id: number; name: string }[]>
    stats: AccessStats
  }>(),
  {
    roleRows: () => [],
    rolePermissions: () => ({}),
    permissionGroups: () => ({}),
    stats: () => ({
      roles: 0,
      permissions: 0,
      permissionGroups: 0,
      assignedStaff: 0,
    }),
  }
)

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filterForm = reactive({
  search: '',
  coverage: '' as '' | 'assigned' | 'unassigned',
})

const hasFilters = computed(() =>
  Boolean(filterForm.search.trim() || filterForm.coverage)
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) {
    chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  }
  if (filterForm.coverage === 'assigned') {
    chips.push({ key: 'coverage', label: 'Has staff assigned' })
  }
  if (filterForm.coverage === 'unassigned') {
    chips.push({ key: 'coverage', label: 'No staff assigned' })
  }

  return chips
})

const filteredRoles = computed(() => {
  const term = filterForm.search.trim().toLowerCase()

  return props.roleRows.filter((role) => {
    if (term && !role.name.toLowerCase().includes(term)) return false
    if (filterForm.coverage === 'assigned' && role.users_count <= 0) return false
    if (filterForm.coverage === 'unassigned' && role.users_count > 0) return false
    return true
  })
})

function clearFilters() {
  filterForm.search = ''
  filterForm.coverage = ''
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = '' as never
}

const kpiCards = computed(() => [
  {
    key: 'roles',
    label: 'Roles',
    value: String(props.stats.roles),
    meta: 'Job functions in the RBAC catalog',
    tone: 'sky',
  },
  {
    key: 'permissions',
    label: 'Permissions',
    value: String(props.stats.permissions),
    meta: `${props.stats.permissionGroups} permission groups`,
    tone: 'violet',
  },
  {
    key: 'assigned',
    label: 'Staff assigned',
    value: String(props.stats.assignedStaff),
    meta: 'Users with at least one role',
    tone: 'teal',
  },
  {
    key: 'protected',
    label: 'Protected roles',
    value: String(props.roleRows.filter((role) => role.is_protected).length),
    meta: 'System roles that cannot be deleted',
    tone: 'amber',
  },
])

const kpiCardClass: Record<string, string> = {
  sky: 'border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white dark:border-sky-900/50 dark:from-sky-950/35 dark:via-neutral-950 dark:to-neutral-950',
  violet:
    'border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-white dark:border-violet-900/50 dark:from-violet-950/30 dark:via-neutral-950 dark:to-neutral-950',
  teal: 'border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-white dark:border-teal-900/50 dark:from-teal-950/30 dark:via-neutral-950 dark:to-neutral-950',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-white dark:border-amber-900/50 dark:from-amber-950/25 dark:via-neutral-950 dark:to-neutral-950',
}

const kpiIconClass: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

const kpiValueClass: Record<string, string> = {
  sky: 'text-slate-900 dark:text-neutral-100',
  violet: 'text-violet-800 dark:text-violet-300',
  teal: 'text-teal-800 dark:text-teal-300',
  amber: 'text-amber-800 dark:text-amber-300',
}

const showCreateRole = ref(false)
const createRole = useForm({ name: '' })

function submitCreateRole() {
  createRole.post('/access-control/roles', {
    onSuccess: () => {
      createRole.reset()
      showCreateRole.value = false
    },
  })
}

const permsRole = ref<RoleRow | null>(null)
const permsForm = useForm<{ permissions: string[] }>({ permissions: [] })

function openPerms(role: RoleRow) {
  permsRole.value = role
  permsForm.permissions = [...(props.rolePermissions[role.id] ?? [])]
}

function submitPerms() {
  if (!permsRole.value) return
  permsForm.put(`/access-control/roles/${permsRole.value.id}/permissions`, {
    onSuccess: () => {
      permsRole.value = null
    },
  })
}

async function destroyRole(role: RoleRow) {
  if (role.is_protected) return
  if (!(await confirmDialog(`Delete role "${role.name}"?`))) return
  router.delete(`/access-control/roles/${role.id}`)
}

function roleBadgeClass(role: RoleRow): string {
  if (role.is_protected) return 'badge b-amber'
  if (role.users_count > 0) return 'badge b-green'
  return 'badge b-gray'
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Roles & Permissions</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Define staff roles and the permissions each role grants. Assign roles to users from the user roles page.
      </p>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href="/access-control/user-roles"
          class="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Manage user roles
        </Link>
        <button
          type="button"
          class="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          @click="showCreateRole = true"
        >
          Create role
        </button>
      </div>
    </div>

    <div class="card mb-4 border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">RBAC overview</p>
      <p class="mt-1 text-sm text-violet-900 dark:text-violet-200">
        Roles bundle permissions for job functions. The super-admin role is protected and always retains full access.
        Changes take effect on the user’s next request after cache refresh.
      </p>
    </div>

    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="card in kpiCards"
        :key="card.key"
        class="rounded-xl border p-4 shadow-sm"
        :class="kpiCardClass[card.tone]"
      >
        <div class="mb-2 flex items-center gap-2.5">
          <span
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="kpiIconClass[card.tone]"
            aria-hidden="true"
          >
            <svg v-if="card.key === 'roles'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else-if="card.key === 'permissions'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <svg v-else-if="card.key === 'assigned'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ card.label }}
          </p>
        </div>
        <p class="text-2xl font-bold leading-none" :class="kpiValueClass[card.tone]">{{ card.value }}</p>
        <p class="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{{ card.meta }}</p>
      </div>
    </div>

    <form class="card mb-3 p-3" @submit.prevent>
      <div class="grid grid-cols-2 items-end gap-2 lg:grid-cols-12">
        <div class="relative col-span-2 lg:col-span-8">
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
            v-model="filterForm.search"
            type="search"
            placeholder="Search role name…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.coverage" :class="fieldClass" aria-label="Staff assignment">
            <option value="">All roles</option>
            <option value="assigned">Has staff assigned</option>
            <option value="unassigned">No staff assigned</option>
          </select>
        </div>

        <div class="col-span-1 flex justify-end lg:col-span-1">
          <button
            v-if="hasFilters"
            type="button"
            class="theme-icon-btn btn-icon inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Clear filters"
            aria-label="Clear filters"
            @click="clearFilters"
          >
            <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        v-if="hasFilters"
        class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800"
      >
        <span class="text-[11px] text-neutral-500">
          {{ filteredRoles.length }} result{{ filteredRoles.length === 1 ? '' : 's' }}
        </span>
        <button
          v-for="chip in activeFilterChips"
          :key="chip.key"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300"
          @click="removeFilter(chip.key)"
        >
          {{ chip.label }}
          <svg class="h-2.5 w-2.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </form>

    <div class="card overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Role catalog</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[760px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Role</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="px-4 py-2.5 text-right">Permissions</th>
              <th class="px-4 py-2.5 text-right">Staff</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="role in filteredRoles"
              :key="role.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ role.name }}</p>
                <p v-if="role.is_protected" class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                  Protected system role
                </p>
              </td>
              <td class="px-4 py-2.5">
                <span :class="roleBadgeClass(role)">
                  {{ role.is_protected ? 'Protected' : role.users_count > 0 ? 'In use' : 'Unused' }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right font-medium text-neutral-900 dark:text-neutral-100">
                {{ role.permissions_count }}
              </td>
              <td class="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                {{ role.users_count }}
              </td>
              <td class="encounters-table__actions px-4 py-2.5 text-right">
                <div class="table-action-group">
                  <TableIconButton
                    variant="permissions"
                    :title="`Permissions for ${role.name}`"
                    @click="openPerms(role)"
                  />
                  <TableIconButton
                    v-if="!role.is_protected"
                    variant="delete"
                    tone="danger"
                    :title="`Delete role ${role.name}`"
                    @click="destroyRole(role)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!filteredRoles.length">
              <td colspan="5" class="px-4 py-12 text-center text-sm text-neutral-500">
                No roles match your filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showCreateRole" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md theme-surface rounded-xl p-6 shadow-lg">
        <h2 class="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">Create role</h2>
        <p class="mb-4 text-sm text-neutral-500">Use lowercase letters, numbers, and hyphens only.</p>
        <form @submit.prevent="submitCreateRole">
          <input
            v-model="createRole.name"
            type="text"
            placeholder="e.g. billing-clerk"
            :class="fieldClass"
            autofocus
          />
          <p v-if="createRole.errors.name" class="mt-1 text-sm text-red-600">{{ createRole.errors.name }}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showCreateRole = false">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="createRole.processing" loading-text="Saving…">
              Create role
            </ActionButton>
          </div>
        </form>
      </div>
    </div>

    <div v-if="permsRole" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="flex max-h-[90vh] w-full max-w-3xl flex-col theme-surface rounded-xl shadow-lg">
        <div class="border-b border-neutral-200 px-6 py-4 dark:border-neutral-700">
          <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Permissions — {{ permsRole.name }}
          </h2>
          <p v-if="permsRole.is_protected" class="mt-1 text-sm text-amber-700 dark:text-amber-300">
            This role is protected and always has full access.
          </p>
        </div>
        <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submitPerms">
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div v-for="(perms, group) in permissionGroups" :key="group">
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{{ group }}</h3>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  v-for="perm in perms"
                  :key="perm.id"
                  class="flex items-start gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"
                >
                  <input
                    v-model="permsForm.permissions"
                    type="checkbox"
                    class="mt-0.5"
                    :value="perm.name"
                    :disabled="permsRole.is_protected"
                  />
                  <span class="break-all text-neutral-800 dark:text-neutral-200">{{ perm.name }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="permsRole = null">
              Cancel
            </button>
            <ActionButton
              type="submit"
              variant="blue"
              :loading="permsForm.processing"
              loading-text="Saving…"
              :disabled="permsRole.is_protected"
            >
              Save permissions
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
