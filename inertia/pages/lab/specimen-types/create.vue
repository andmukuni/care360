<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

defineProps<{ disciplines: string[] }>()

const form = useForm({
  name: '',
  code: '',
  default_unit: '',
  test_category: '',
  sort_order: 0,
  is_active: true,
})

function submit() {
  form.post('/lab/specimen-types')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">New Sample Type</h1></template>

    <form class="max-w-lg space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Code</label>
          <input v-model="form.code" type="text" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.code" class="mt-1 text-sm text-red-600">{{ form.errors.code }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Default unit</label>
          <input v-model="form.default_unit" type="text" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.default_unit" class="mt-1 text-sm text-red-600">{{ form.errors.default_unit }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Category</label>
          <input v-model="form.test_category" list="disciplines" type="text" class="theme-field w-full rounded px-3 py-2" />
          <datalist id="disciplines">
            <option v-for="d in disciplines" :key="d" :value="d" />
          </datalist>
          <p v-if="form.errors.test_category" class="mt-1 text-sm text-red-600">{{ form.errors.test_category }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Sort order</label>
          <input v-model.number="form.sort_order" type="number" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.sort_order" class="mt-1 text-sm text-red-600">{{ form.errors.sort_order }}</p>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" /> Active</label>
      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
        <Link href="/lab/specimen-types" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
