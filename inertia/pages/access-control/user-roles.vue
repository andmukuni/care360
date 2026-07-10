<script setup lang="ts">
import { ref } from 'vue'
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface RoleRow {
  id: number
  name: string
}

interface UserRow {
  id: number
  name: string
  email: string
  roles: string[]
}

const props = defineProps<{
  roles: RoleRow[]
  users: UserRow[]
}>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'roles', label: 'Roles', sortable: false },
]

const rolesUser = ref<UserRow | null>(null)
const form = useForm<{ roles: string[]; _redirect: string }>({ roles: [], _redirect: 'access-control.user-roles' })

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

    <div class="mb-4 flex justify-end">
      <Link href="/access-control" class="text-sm text-blue-600 hover:underline">← Back to access control</Link>
    </div>

    <DataTable :columns="columns" :rows="props.users" :search-keys="['name', 'email']">
      <template #cell:roles="{ row }">
        <span v-if="!row.roles.length" class="text-sand-11">—</span>
        <span v-for="r in row.roles" :key="r" class="mr-1 inline-block rounded bg-sand-3 px-1.5 py-0.5 text-xs">
          {{ r }}
        </span>
      </template>
      <template #actions="{ row }">
        <button type="button" class="text-blue-600 hover:underline" @click="open(row)">Edit Roles</button>
      </template>
    </DataTable>

    <div v-if="rolesUser" class="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md theme-surface rounded-lg p-6 shadow-lg">
        <h2 class="mb-4 text-base font-semibold">Roles — {{ rolesUser.name }}</h2>
        <form @submit.prevent="submit">
          <div class="max-h-64 space-y-2 overflow-y-auto">
            <label v-for="role in props.roles" :key="role.id" class="flex items-center gap-2 text-sm">
              <input v-model="form.roles" type="checkbox" :value="role.name" />
              {{ role.name }}
            </label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="rolesUser = null">
              Cancel
            </button>
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save Roles</ActionButton>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
