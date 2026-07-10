<script setup lang="ts">
import { ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Service {
  id: number
  name: string
  slug: string
  category: string
  categoryLabel: string
  phoneNumber: string
  secondaryPhone: string | null
  description: string | null
  instructions: string | null
  is247: boolean
  isActive: boolean
  sortOrder: number
  contacts24hCount: number
}

interface Contact {
  id: number
  patientName: string
  patientNumber: string | null
  serviceName: string
  source: string
  phoneDialed: string | null
  contactedAt: string | null
}

const props = defineProps<{
  categories: Record<string, string>
  services: Service[]
  recentContacts: Contact[]
}>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'categoryLabel', label: 'Category' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'contacts24hCount', label: 'Contacts (24h)' },
  { key: 'isActive', label: 'Active' },
]

const showForm = ref(false)
const editingId = ref<number | null>(null)

const form = useForm({
  name: '',
  category: 'ambulance',
  phone_number: '',
  secondary_phone: '',
  description: '',
  instructions: '',
  is_24_7: false,
  is_active: true,
  sort_order: 0,
})

function openCreate() {
  editingId.value = null
  form.reset()
  form.clearErrors()
  showForm.value = true
}

function openEdit(s: Service) {
  editingId.value = s.id
  form.clearErrors()
  form.name = s.name
  form.category = s.category
  form.phone_number = s.phoneNumber
  form.secondary_phone = s.secondaryPhone ?? ''
  form.description = s.description ?? ''
  form.instructions = s.instructions ?? ''
  form.is_24_7 = s.is247
  form.is_active = s.isActive
  form.sort_order = s.sortOrder
  showForm.value = true
}

function submit() {
  if (editingId.value) {
    form.put(`/emergency-services/${editingId.value}`, { onSuccess: () => (showForm.value = false) })
  } else {
    form.post('/emergency-services', { onSuccess: () => (showForm.value = false) })
  }
}

function destroy(s: Service) {
  if (confirm(`Remove ${s.name}?`)) {
    router.delete(`/emergency-services/${s.id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Emergency Services</h1></template>

    <div class="mb-4 flex justify-end">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="openCreate">
        New Service
      </button>
    </div>

    <DataTable :columns="columns" :rows="props.services">
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <button type="button" class="text-blue-600 hover:underline" @click="openEdit(row)">Edit</button>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row)">Delete</button>
      </template>
    </DataTable>

    <div class="mt-8">
      <h2 class="mb-3 text-base font-semibold">Recent Contacts</h2>
      <div class="overflow-x-auto theme-panel rounded-lg">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-sand-6 text-left text-sand-11">
              <th class="px-3 py-2 font-medium">Patient</th>
              <th class="px-3 py-2 font-medium">Service</th>
              <th class="px-3 py-2 font-medium">Source</th>
              <th class="px-3 py-2 font-medium">Phone</th>
              <th class="px-3 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in props.recentContacts" :key="c.id" class="border-b border-sand-4">
              <td class="px-3 py-2">{{ c.patientName }} <span class="text-sand-11">{{ c.patientNumber }}</span></td>
              <td class="px-3 py-2">{{ c.serviceName }}</td>
              <td class="px-3 py-2">{{ c.source }}</td>
              <td class="px-3 py-2">{{ c.phoneDialed ?? '—' }}</td>
              <td class="px-3 py-2">{{ c.contactedAt ?? '—' }}</td>
            </tr>
            <tr v-if="!props.recentContacts.length">
              <td colspan="5" class="px-3 py-6 text-center text-sand-11">No recent contacts.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg theme-panel rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Service' : 'New Service' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Name</label>
              <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Category</label>
              <select v-model="form.category" class="theme-field w-full rounded px-3 py-2">
                <option v-for="(label, key) in props.categories" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Phone Number</label>
              <input v-model="form.phone_number" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.phone_number" class="mt-1 text-sm text-red-600">{{ form.errors.phone_number }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Secondary Phone</label>
              <input v-model="form.secondary_phone" type="text" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Description</label>
            <textarea v-model="form.description" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Instructions</label>
            <textarea v-model="form.instructions" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm"><input v-model="form.is_24_7" type="checkbox" /> 24/7</label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" /> Active</label>
            <div class="flex items-center gap-2 text-sm">
              <span>Sort</span>
              <input v-model.number="form.sort_order" type="number" min="0" max="999" class="w-20 rounded border border-sand-6 px-2 py-1" />
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
