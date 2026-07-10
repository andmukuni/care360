<script setup lang="ts">
import { ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Doctor {
  id: number
  name: string
  specialty: string
  bio: string | null
  rating: number
  patientsCount: number | null
  yearsExperience: number | null
  reviewCount: number | null
  sessionFee: number | null
  photoUrl: string | null
  photoPath: string | null
  sortOrder: number
  isActive: boolean
}

defineProps<{ doctors: Doctor[] }>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'rating', label: 'Rating' },
  { key: 'yearsExperience', label: 'Experience' },
  { key: 'isActive', label: 'Active' },
]

const showForm = ref(false)
const editingId = ref<number | null>(null)

const form = useForm({
  name: '',
  specialty: '',
  bio: '',
  rating: 5,
  patients_count: null as number | null,
  years_experience: null as number | null,
  review_count: null as number | null,
  session_fee: null as number | null,
  photo_url: '',
  sort_order: 0,
  is_active: true,
})

function openCreate() {
  editingId.value = null
  form.reset()
  form.clearErrors()
  showForm.value = true
}

function openEdit(d: Doctor) {
  editingId.value = d.id
  form.clearErrors()
  form.name = d.name
  form.specialty = d.specialty
  form.bio = d.bio ?? ''
  form.rating = d.rating
  form.patients_count = d.patientsCount
  form.years_experience = d.yearsExperience
  form.review_count = d.reviewCount
  form.session_fee = d.sessionFee
  form.photo_url = d.photoUrl ?? ''
  form.sort_order = d.sortOrder
  form.is_active = d.isActive
  showForm.value = true
}

function submit() {
  if (editingId.value) {
    form.put(`/featured-doctors/${editingId.value}`, { onSuccess: () => (showForm.value = false) })
  } else {
    form.post('/featured-doctors', { onSuccess: () => (showForm.value = false) })
  }
}

function destroy(d: Doctor) {
  if (confirm(`Delete ${d.name}?`)) {
    router.delete(`/featured-doctors/${d.id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Featured Doctors</h1></template>

    <div class="mb-4 flex justify-end">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="openCreate">
        New Doctor
      </button>
    </div>

    <DataTable :columns="columns" :rows="doctors">
      <template #cell:rating="{ row }">{{ row.rating.toFixed(1) }} ★</template>
      <template #cell:yearsExperience="{ row }">{{ row.yearsExperience ?? '—' }} yrs</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <button type="button" class="text-blue-600 hover:underline" @click="openEdit(row)">Edit</button>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row)">Delete</button>
      </template>
    </DataTable>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg theme-panel rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Doctor' : 'New Doctor' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Name</label>
              <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Specialty</label>
              <input v-model="form.specialty" type="text" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.specialty" class="mt-1 text-sm text-red-600">{{ form.errors.specialty }}</p>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Rating</label>
              <input v-model.number="form.rating" type="number" step="0.1" min="0" max="5" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Patients</label>
              <input v-model.number="form.patients_count" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Years</label>
              <input v-model.number="form.years_experience" type="number" min="0" max="80" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Reviews</label>
              <input v-model.number="form.review_count" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Session Fee</label>
              <input v-model.number="form.session_fee" type="number" step="0.01" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Photo URL</label>
            <input v-model="form.photo_url" type="url" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.photo_url" class="mt-1 text-sm text-red-600">{{ form.errors.photo_url }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Bio</label>
            <textarea v-model="form.bio" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
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
