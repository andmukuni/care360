<script setup lang="ts">
import { ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Tip {
  id: number
  category: string
  title: string
  message: string
  sortOrder: number
  isActive: boolean
}

defineProps<{
  tips: Tip[]
  todaysTip: { category: string; title: string; message: string }
}>()

const columns = [
  { key: 'category', label: 'Category' },
  { key: 'title', label: 'Title' },
  { key: 'message', label: 'Message' },
  { key: 'isActive', label: 'Active' },
]

const showForm = ref(false)
const editingId = ref<number | null>(null)

const form = useForm({
  category: '',
  title: '',
  message: '',
  sort_order: 0,
  is_active: true,
})

function openCreate() {
  editingId.value = null
  form.reset()
  form.clearErrors()
  showForm.value = true
}

function openEdit(t: Tip) {
  editingId.value = t.id
  form.clearErrors()
  form.category = t.category
  form.title = t.title
  form.message = t.message
  form.sort_order = t.sortOrder
  form.is_active = t.isActive
  showForm.value = true
}

function submit() {
  if (editingId.value) {
    form.put(`/health-tips/${editingId.value}`, { onSuccess: () => (showForm.value = false) })
  } else {
    form.post('/health-tips', { onSuccess: () => (showForm.value = false) })
  }
}

function destroy(t: Tip) {
  if (confirm(`Delete “${t.title}”?`)) {
    router.delete(`/health-tips/${t.id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Health Tips</h1></template>

    <div class="mb-4 theme-panel rounded-lg p-4">
      <div class="text-xs uppercase tracking-wide text-sand-11">Currently showing in rotation</div>
      <div class="mt-1 text-sm font-medium">{{ todaysTip.title }}</div>
      <div class="text-xs text-sand-11">{{ todaysTip.category }}</div>
      <p class="mt-1 text-sm">{{ todaysTip.message }}</p>
    </div>

    <div class="mb-4 flex justify-end">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="openCreate">
        New Tip
      </button>
    </div>

    <DataTable :columns="columns" :rows="tips">
      <template #cell:message="{ row }">
        <span class="line-clamp-2">{{ row.message }}</span>
      </template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <button type="button" class="text-blue-600 hover:underline" @click="openEdit(row)">Edit</button>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row)">Delete</button>
      </template>
    </DataTable>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Tip' : 'New Tip' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Category</label>
              <input v-model="form.category" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.category" class="mt-1 text-sm text-red-600">{{ form.errors.category }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Title</label>
            <input v-model="form.title" type="text" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.title" class="mt-1 text-sm text-red-600">{{ form.errors.title }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Message</label>
            <textarea v-model="form.message" rows="4" class="theme-field w-full rounded px-3 py-2"></textarea>
            <p v-if="form.errors.message" class="mt-1 text-sm text-red-600">{{ form.errors.message }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.is_active" type="checkbox" /> Active
          </label>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
