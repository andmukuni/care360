<script setup lang="ts">
import { ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface RoleRow {
  id: number
  name: string
  permissions: string[]
  permissions_count: number
  users_count: number
}

interface UserRow {
  id: number
  name: string
  email: string
  roles: string[]
}

const props = defineProps<{
  roles: RoleRow[]
  permissionGroups: Record<string, { id: number; name: string }[]>
  users: UserRow[]
}>()

const createRole = useForm({ name: '' })
function submitCreateRole() {
  createRole.post('/access-control/roles', {
    onSuccess: () => createRole.reset(),
  })
}

const permsRole = ref<RoleRow | null>(null)
const permsForm = useForm<{ permissions: string[] }>({ permissions: [] })
function openPerms(role: RoleRow) {
  permsRole.value = role
  permsForm.permissions = [...role.permissions]
}
function submitPerms() {
  if (!permsRole.value) return
  permsForm.put(`/access-control/roles/${permsRole.value.id}/permissions`, {
    onSuccess: () => {
      permsRole.value = null
    },
  })
}

function destroyRole(role: RoleRow) {
  if (confirm(`Delete role "${role.name}"?`)) {
    router.delete(`/access-control/roles/${role.id}`)
  }
}

const rolesUser = ref<UserRow | null>(null)
const userRolesForm = useForm<{ roles: string[]; _redirect: string }>({ roles: [], _redirect: 'access-control.index' })
function openUserRoles(user: UserRow) {
  rolesUser.value = user
  userRolesForm.roles = [...user.roles]
}
function submitUserRoles() {
  if (!rolesUser.value) return
  userRolesForm.put(`/access-control/users/${rolesUser.value.id}/roles`, {
    onSuccess: () => {
      rolesUser.value = null
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Access Control</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/access-control/user-roles" class="text-sm text-blue-600 hover:underline">Manage user roles →</Link>
    </div>

    <section class="mb-8">
      <h2 class="mb-3 text-base font-medium">Roles</h2>

      <form class="mb-4 flex gap-2" @submit.prevent="submitCreateRole">
        <input
          v-model="createRole.name"
          type="text"
          placeholder="new-role-name"
          class="w-64 rounded border border-sand-6 px-3 py-2 text-sm"
        />
        <ActionButton type="submit" variant="blue" :loading="createRole.processing" loading-text="Saving…">Create Role</ActionButton>
        <span v-if="createRole.errors.name" class="self-center text-sm text-red-600">{{ createRole.errors.name }}</span>
      </form>

      <div class="overflow-x-auto theme-panel rounded-lg">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-sand-6 text-left text-sand-11">
              <th class="px-3 py-2 font-medium">Role</th>
              <th class="px-3 py-2 font-medium">Permissions</th>
              <th class="px-3 py-2 font-medium">Users</th>
              <th class="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in props.roles" :key="role.id" class="border-b border-sand-4">
              <td class="px-3 py-2 font-medium">{{ role.name }}</td>
              <td class="px-3 py-2">{{ role.permissions_count }}</td>
              <td class="px-3 py-2">{{ role.users_count }}</td>
              <td class="px-3 py-2 text-right">
                <button type="button" class="text-blue-600 hover:underline" @click="openPerms(role)">
                  Permissions
                </button>
                <button
                  v-if="role.name !== 'super-admin'"
                  type="button"
                  class="ml-3 text-red-600 hover:underline"
                  @click="destroyRole(role)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-base font-medium">Users</h2>
      <div class="overflow-x-auto theme-panel rounded-lg">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-sand-6 text-left text-sand-11">
              <th class="px-3 py-2 font-medium">Name</th>
              <th class="px-3 py-2 font-medium">Email</th>
              <th class="px-3 py-2 font-medium">Roles</th>
              <th class="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in props.users" :key="user.id" class="border-b border-sand-4">
              <td class="px-3 py-2">{{ user.name }}</td>
              <td class="px-3 py-2 text-sand-11">{{ user.email }}</td>
              <td class="px-3 py-2">
                <span v-if="!user.roles.length" class="text-sand-11">—</span>
                <span v-for="r in user.roles" :key="r" class="mr-1 inline-block rounded bg-sand-3 px-1.5 py-0.5 text-xs">
                  {{ r }}
                </span>
              </td>
              <td class="px-3 py-2 text-right">
                <button type="button" class="text-blue-600 hover:underline" @click="openUserRoles(user)">
                  Edit Roles
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="permsRole" class="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-2xl theme-surface rounded-lg p-6 shadow-lg">
        <h2 class="mb-4 text-base font-semibold">Permissions — {{ permsRole.name }}</h2>
        <form @submit.prevent="submitPerms">
          <div class="max-h-96 space-y-4 overflow-y-auto">
            <div v-for="(perms, group) in props.permissionGroups" :key="group">
              <h3 class="mb-1 text-xs font-medium uppercase text-sand-11">{{ group }}</h3>
              <div class="grid grid-cols-2 gap-2">
                <label v-for="perm in perms" :key="perm.id" class="flex items-center gap-2 text-sm">
                  <input v-model="permsForm.permissions" type="checkbox" :value="perm.name" />
                  {{ perm.name }}
                </label>
              </div>
            </div>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="permsRole = null">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="permsForm.processing" loading-text="Saving…">Save Permissions</ActionButton>
          </div>
        </form>
      </div>
    </div>

    <div v-if="rolesUser" class="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md theme-surface rounded-lg p-6 shadow-lg">
        <h2 class="mb-4 text-base font-semibold">Roles — {{ rolesUser.name }}</h2>
        <form @submit.prevent="submitUserRoles">
          <div class="max-h-64 space-y-2 overflow-y-auto">
            <label v-for="role in props.roles" :key="role.id" class="flex items-center gap-2 text-sm">
              <input v-model="userRolesForm.roles" type="checkbox" :value="role.name" />
              {{ role.name }}
            </label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="rolesUser = null">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="userRolesForm.processing" loading-text="Saving…">Save Roles</ActionButton>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
