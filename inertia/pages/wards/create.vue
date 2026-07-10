<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

defineProps<{ wings: string[]; types: string[] }>()

const form = useForm({
  name: '',
  type: 'General',
  wing: 'Male',
  location: '',
  notes: '',
  is_active: true,
})

function submit() {
  form.post('/wards')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">New Ward</h1></template>

    <form class="max-w-lg space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Type</label>
          <select v-model="form.type" class="theme-field w-full rounded px-3 py-2">
            <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
          </select>
          <p v-if="form.errors.type" class="mt-1 text-sm text-red-600">{{ form.errors.type }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Wing</label>
          <select v-model="form.wing" class="theme-field w-full rounded px-3 py-2">
            <option v-for="w in wings" :key="w" :value="w">{{ w }}</option>
          </select>
          <p v-if="form.errors.wing" class="mt-1 text-sm text-red-600">{{ form.errors.wing }}</p>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Location</label>
        <input v-model="form.location" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.location" class="mt-1 text-sm text-red-600">{{ form.errors.location }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Notes</label>
        <textarea v-model="form.notes" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
        <p v-if="form.errors.notes" class="mt-1 text-sm text-red-600">{{ form.errors.notes }}</p>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="form.is_active" type="checkbox" /> Active
      </label>
      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
        <Link href="/wards" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
