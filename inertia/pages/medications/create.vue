<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

defineProps<{ categories: string[] }>()

const form = useForm({
  name: '',
  category: '',
  form: '',
  unit: '',
  strength: '',
  generic_name: '',
  default_route: '',
  default_frequency: '',
  is_controlled: false,
  is_active: true,
  notes: '',
})

function submit() {
  form.post('/medications')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">New Medication</h1></template>

    <form class="max-w-xl space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Category</label>
          <input v-model="form.category" list="med-categories" type="text" class="theme-field w-full rounded px-3 py-2" />
          <datalist id="med-categories">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
          <p v-if="form.errors.category" class="mt-1 text-sm text-red-600">{{ form.errors.category }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Form</label>
          <input v-model="form.form" type="text" placeholder="e.g. Tablet" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.form" class="mt-1 text-sm text-red-600">{{ form.errors.form }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Unit</label>
          <input v-model="form.unit" type="text" placeholder="e.g. 500mg" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.unit" class="mt-1 text-sm text-red-600">{{ form.errors.unit }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Strength</label>
          <input v-model="form.strength" type="text" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.strength" class="mt-1 text-sm text-red-600">{{ form.errors.strength }}</p>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Generic name</label>
        <input v-model="form.generic_name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.generic_name" class="mt-1 text-sm text-red-600">{{ form.errors.generic_name }}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Default route</label>
          <input v-model="form.default_route" type="text" class="theme-field w-full rounded px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Default frequency</label>
          <input v-model="form.default_frequency" type="text" class="theme-field w-full rounded px-3 py-2" />
        </div>
      </div>
      <div class="flex gap-6">
        <label class="flex items-center gap-2 text-sm"><input v-model="form.is_controlled" type="checkbox" /> Controlled</label>
        <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" /> Active</label>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Notes</label>
        <textarea v-model="form.notes" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
      </div>
      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
        <Link href="/medications" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
