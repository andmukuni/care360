<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  categories: { id: number; name: string; testCategory: string | null }[]
  resultForms: { id: number; key: string; label: string; description: string | null }[]
}>()

const form = useForm({
  name: '',
  lab_specimen_type_id: props.categories[0]?.id ?? null,
  lab_result_form_id: props.resultForms[0]?.id ?? null,
  description: '',
  is_active: true,
})

function submit() {
  form.post('/test-types')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">New Test Type</h1></template>

    <form class="max-w-lg space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Sample type</label>
        <select v-model="form.lab_specimen_type_id" class="theme-field w-full rounded px-3 py-2">
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.name }}<template v-if="c.testCategory"> — {{ c.testCategory }}</template>
          </option>
        </select>
        <p v-if="form.errors.lab_specimen_type_id" class="mt-1 text-sm text-red-600">{{ form.errors.lab_specimen_type_id }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Result form</label>
        <select v-model="form.lab_result_form_id" class="theme-field w-full rounded px-3 py-2">
          <option v-for="f in resultForms" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
        <p v-if="form.errors.lab_result_form_id" class="mt-1 text-sm text-red-600">{{ form.errors.lab_result_form_id }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Discipline / description</label>
        <input v-model="form.description" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.description" class="mt-1 text-sm text-red-600">{{ form.errors.description }}</p>
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" /> Active</label>
      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
        <Link href="/test-types" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
