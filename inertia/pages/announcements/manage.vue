<script setup lang="ts">
import { ref } from 'vue'
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface AnnouncementRow {
  id: number
  title: string
  message: string
  status: string
  audience: string
  target_roles: string[]
  author: string | null
  is_active: boolean
  published_at: string | null
}

const props = defineProps<{
  announcements: AnnouncementRow[]
  roles: string[]
}>()

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'audience', label: 'Audience' },
  { key: 'author', label: 'Author' },
  { key: 'published_at', label: 'Published' },
]

const showForm = ref(false)
const form = useForm<{
  title: string
  message: string
  status: string
  audience: string
  target_roles: string[]
}>({
  title: '',
  message: '',
  status: 'general',
  audience: 'all',
  target_roles: [],
})

function submit() {
  form.post('/announcements/manage', {
    onSuccess: () => {
      form.reset()
      showForm.value = false
    },
  })
}

const statusLabels: Record<string, string> = {
  general: 'General',
  urgent: 'Urgent',
  follow_up: 'Follow-up',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Announcements</h1></template>

    <div class="mb-4 flex justify-end">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="showForm = !showForm">
        {{ showForm ? 'Close' : 'New Announcement' }}
      </button>
    </div>

    <form v-if="showForm" class="mb-6 space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Title</label>
        <input v-model="form.title" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.title" class="mt-1 text-sm text-red-600">{{ form.errors.title }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Message</label>
        <textarea v-model="form.message" rows="4" class="theme-field w-full rounded px-3 py-2"></textarea>
        <p v-if="form.errors.message" class="mt-1 text-sm text-red-600">{{ form.errors.message }}</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium mb-1">Status</label>
          <select v-model="form.status" class="theme-field w-full rounded px-3 py-2">
            <option value="general">General</option>
            <option value="urgent">Urgent</option>
            <option value="follow_up">Follow-up</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Audience</label>
          <select v-model="form.audience" class="theme-field w-full rounded px-3 py-2">
            <option value="all">Everyone</option>
            <option value="roles">Specific roles</option>
          </select>
        </div>
      </div>
      <div v-if="form.audience === 'roles'">
        <label class="block text-sm font-medium mb-1">Target Roles</label>
        <div class="flex flex-wrap gap-3">
          <label v-for="role in props.roles" :key="role" class="flex items-center gap-2 text-sm">
            <input v-model="form.target_roles" type="checkbox" :value="role" />
            {{ role }}
          </label>
        </div>
      </div>
      <div class="pt-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Submitting…">Publish</ActionButton>
      </div>
    </form>

    <DataTable :columns="columns" :rows="props.announcements" :search-keys="['title', 'message', 'author']">
      <template #cell:title="{ row }">
        <Link :href="`/announcements/${row.id}`" class="text-blue-600 hover:underline">{{ row.title }}</Link>
      </template>
      <template #cell:status="{ row }">{{ statusLabels[row.status] ?? row.status }}</template>
      <template #cell:audience="{ row }">
        <span v-if="row.audience === 'all'">Everyone</span>
        <span v-else>{{ row.target_roles.join(', ') || 'Roles' }}</span>
      </template>
      <template #cell:published_at="{ row }">{{ formatDate(row.published_at) }}</template>
    </DataTable>
  </StaffLayout>
</template>
