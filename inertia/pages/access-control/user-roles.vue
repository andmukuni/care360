<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'

interface RoleOption {
  id: number
  name: string
}

interface UserRow {
  id: number
  name: string
  email: string
  roles: string[]
}

interface UserRoleKpis {
  total: number
  withRoles: number
  withoutRoles: number
  roleCount: number
}

const props = withDefaults(
  defineProps<{
    assignableRoles: RoleOption[]
    users: UserRow[]
    kpis: UserRoleKpis
  }>(),
  {
    assignableRoles: () => [],
    users: () => [],
    kpis: () => ({
      total: 0,
      withRoles: 0,
      withoutRoles: 0,
      roleCount: 0,
    }),
  }
)

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filterForm = reactive({
  search: '',
  role: '',
  coverage: '' as '' | 'assigned' | 'unassigned',
})

const hasFilters = computed(() =>
  Boolean(filterForm.search.trim() || filterForm.role || filterForm.coverage)
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) {
    chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  }
  if (filterForm.role) {
    chips.push({ key: 'role', label: `Role: ${filterForm.role}` })
  }
  if (filterForm.coverage === 'assigned') {
    chips.push({ key: 'coverage', label: 'Has roles' })
  }
  if (filterForm.coverage === 'unassigned') {
    chips.push({ key: 'coverage', label: 'No roles assigned' })
  }

  return chips
})

const filteredUsers = computed(() => {
  const term = filterForm.search.trim().toLowerCase()

  return props.users.filter((user) => {
    if (term) {
      const haystack = [user.name, user.email, ...user.roles].join(' ').toLowerCase()
      if (!haystack.includes(term)) return false
    }
    if (filterForm.role && !user.roles.includes(filterForm.role)) return false
    if (filterForm.coverage === 'assigned' && user.roles.length === 0) return false
    if (filterForm.coverage === 'unassigned' && user.roles.length > 0) return false
    return true
  })
})

function clearFilters() {
  filterForm.search = ''
  filterForm.role = ''
  filterForm.coverage = ''
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = '' as never
}

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Staff users',
    value: String(props.kpis.total),
    meta: 'Accounts that can sign in',
    tone: 'sky',
  },
  {
    key: 'assigned',
    label: 'With roles',
    value: String(props.kpis.withRoles),
    meta:
      props.kpis.withoutRoles > 0
        ? `${props.kpis.withoutRoles} still unassigned`
        : 'Everyone has at least one role',
    tone: 'teal',
  },
  {
    key: 'unassigned',
    label: 'Unassigned',
    value: String(props.kpis.withoutRoles),
    meta: 'Users without any RBAC role',
    tone: 'amber',
  },
  {
    key: 'roles',
    label: 'Assignable roles',
    value: String(props.kpis.roleCount),
    meta: 'Roles available in the catalog',
    tone: 'violet',
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

const rolesUser = ref<UserRow | null>(null)
const form = useForm<{ roles: string[]; _redirect: string }>({
  roles: [],
  _redirect: 'access-control.user-roles',
})

function open(user: UserRow) {
  rolesUser.value = user
  form.roles = [...user.roles]
}

function submit() {
  if (!rolesUser.value) return
  form.put(`/access-control/users/${rolesUser.value.id}/roles`, {
    onSuccess: () => {
      rolesUser.value = null
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">User Roles</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Assign one or more roles to each staff user. Permissions come from the roles you define on the access control page.
      </p>
      <Link
        href="/access-control"
        class="shrink-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        ← Roles & permissions
      </Link>
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
            <svg v-if="card.key === 'total'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else-if="card.key === 'assigned'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.key === 'unassigned'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
        <div class="relative col-span-2 lg:col-span-5">
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
            placeholder="Search name, email, or role…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.role" :class="fieldClass" aria-label="Role">
            <option value="">All roles</option>
            <option v-for="role in assignableRoles" :key="role.id" :value="role.name">
              {{ role.name }}
            </option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.coverage" :class="fieldClass" aria-label="Assignment state">
            <option value="">All assignment states</option>
            <option value="assigned">Has roles</option>
            <option value="unassigned">No roles assigned</option>
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
          {{ filteredUsers.length }} result{{ filteredUsers.length === 1 ? '' : 's' }}
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
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Staff role assignments</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[880px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Staff member</th>
              <th class="px-4 py-2.5 text-left">Email</th>
              <th class="px-4 py-2.5 text-left">Roles</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">{{ user.name }}</td>
              <td class="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{{ user.email }}</td>
              <td class="px-4 py-2.5">
                <span v-if="!user.roles.length" class="badge b-amber">Unassigned</span>
                <div v-else class="flex flex-wrap gap-1">
                  <span
                    v-for="role in user.roles"
                    :key="role"
                    class="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    {{ role }}
                  </span>
                </div>
              </td>
              <td class="encounters-table__actions px-4 py-2.5 text-right">
                <div class="table-action-group">
                  <TableIconButton variant="roles" title="Edit roles" @click="open(user)" />
                </div>
              </td>
            </tr>
            <tr v-if="!filteredUsers.length">
              <td colspan="4" class="px-4 py-12 text-center text-sm text-neutral-500">
                No users match your filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="rolesUser" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="flex max-h-[90vh] w-full max-w-md flex-col theme-surface rounded-xl shadow-lg">
        <div class="border-b border-neutral-200 px-6 py-4 dark:border-neutral-700">
          <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">Roles — {{ rolesUser.name }}</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ rolesUser.email }}</p>
        </div>
        <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
          <div class="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
            <label
              v-for="role in assignableRoles"
              :key="role.id"
              class="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"
            >
              <input v-model="form.roles" type="checkbox" :value="role.name" />
              <span>{{ role.name }}</span>
            </label>
          </div>
          <div class="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="rolesUser = null">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">
              Save roles
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
