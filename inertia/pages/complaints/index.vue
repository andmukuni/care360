<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Complaint {
  id: number
  title: string
  description: string
  pageUrl: string | null
  severity: string
  status: string
  createdAt: string | null
  resolvedAt: string | null
}

defineProps<{ complaints: Complaint[] }>()

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Submitted' },
]

const showForm = ref(false)

const form = useForm({
  title: '',
  description: '',
  page_url: '',
  severity: 'low',
})

function submit() {
  form.post('/complaints', {
    onSuccess: () => {
      showForm.value = false
      form.reset()
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">My Complaints</h1></template>

    <div class="mb-4 flex justify-end">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="showForm = true">
        Report an Issue
      </button>
    </div>

    <DataTable :columns="columns" :rows="complaints">
      <template #cell:severity="{ row }">
        <span class="capitalize">{{ row.severity }}</span>
      </template>
      <template #cell:status="{ row }">
        <span class="capitalize">{{ row.status }}</span>
      </template>
    </DataTable>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">Report an Issue</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div>
            <label class="mb-1 block text-sm font-medium">Title</label>
            <input v-model="form.title" type="text" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.title" class="mt-1 text-sm text-red-600">{{ form.errors.title }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Description</label>
            <textarea v-model="form.description" rows="4" class="theme-field w-full rounded px-3 py-2"></textarea>
            <p v-if="form.errors.description" class="mt-1 text-sm text-red-600">{{ form.errors.description }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Page URL (optional)</label>
            <input v-model="form.page_url" type="url" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.page_url" class="mt-1 text-sm text-red-600">{{ form.errors.page_url }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Severity</label>
            <select v-model="form.severity" class="theme-field w-full rounded px-3 py-2">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Submitting…">Submit</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
