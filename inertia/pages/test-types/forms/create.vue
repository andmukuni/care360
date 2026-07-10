<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface FieldRow {
  key: string
  label: string
  field_type: string
  options_text: string
  placeholder: string
  is_required: boolean
}

const props = defineProps<{
  form: {
    key: string
    label: string
    description: string | null
    templateKey: string | null
    sortOrder: number
    isActive: boolean
    isSystem: boolean
  }
  templateOptions: Record<string, string>
  fieldRows: FieldRow[]
  testTypes: { id: number; name: string; category: string | null; current_form: string | null }[]
  selectedTestTypeIds: number[]
}>()

const FIELD_TYPES = ['text', 'number', 'textarea', 'select']

const form = useForm({
  key: props.form.key,
  label: props.form.label,
  description: props.form.description ?? '',
  template_key: props.form.templateKey ?? 'quantitative',
  sort_order: props.form.sortOrder,
  is_active: props.form.isActive,
  fields: [...props.fieldRows] as FieldRow[],
  test_type_ids: [...props.selectedTestTypeIds] as number[],
})

function addField() {
  form.fields.push({ key: '', label: '', field_type: 'text', options_text: '', placeholder: '', is_required: false })
}

function removeField(index: number) {
  form.fields.splice(index, 1)
}

function submit() {
  form.post('/test-types/forms')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">New Result Form</h1></template>

    <form class="max-w-3xl space-y-6" @submit.prevent="submit">
      <div class="space-y-4 theme-panel rounded-lg p-6">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Key</label>
            <input v-model="form.key" type="text" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.key" class="mt-1 text-sm text-red-600">{{ form.errors.key }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Label</label>
            <input v-model="form.label" type="text" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.label" class="mt-1 text-sm text-red-600">{{ form.errors.label }}</p>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Description</label>
          <input v-model="form.description" type="text" class="theme-field w-full rounded px-3 py-2" />
          <p v-if="form.errors.description" class="mt-1 text-sm text-red-600">{{ form.errors.description }}</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Base template</label>
            <select v-model="form.template_key" class="theme-field w-full rounded px-3 py-2">
              <option v-for="(label, key) in templateOptions" :key="key" :value="key">{{ label }}</option>
            </select>
            <p v-if="form.errors.template_key" class="mt-1 text-sm text-red-600">{{ form.errors.template_key }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Sort order</label>
            <input v-model.number="form.sort_order" type="number" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.sort_order" class="mt-1 text-sm text-red-600">{{ form.errors.sort_order }}</p>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" /> Active</label>
      </div>

      <div class="space-y-3 theme-panel rounded-lg p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-medium">Custom fields</h2>
          <button type="button" class="rounded border border-sand-6 px-3 py-1 text-sm" @click="addField">Add field</button>
        </div>
        <p class="text-xs text-sand-11">Leave empty to use the base template layout.</p>
        <div v-for="(field, i) in form.fields" :key="i" class="grid grid-cols-12 gap-2 border-t border-sand-4 pt-3">
          <input v-model="field.label" placeholder="Label" class="col-span-3 rounded border border-sand-6 px-2 py-1 text-sm" />
          <input v-model="field.key" placeholder="key" class="col-span-2 rounded border border-sand-6 px-2 py-1 text-sm" />
          <select v-model="field.field_type" class="col-span-2 rounded border border-sand-6 px-2 py-1 text-sm">
            <option v-for="t in FIELD_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <input v-model="field.placeholder" placeholder="Placeholder" class="col-span-2 rounded border border-sand-6 px-2 py-1 text-sm" />
          <input
            v-if="field.field_type === 'select'"
            v-model="field.options_text"
            placeholder="Options (comma / newline)"
            class="col-span-2 rounded border border-sand-6 px-2 py-1 text-sm"
          />
          <div class="col-span-1 flex items-center gap-1">
            <label class="flex items-center gap-1 text-xs"><input v-model="field.is_required" type="checkbox" />req</label>
            <button type="button" class="text-red-600" @click="removeField(i)">✕</button>
          </div>
        </div>
      </div>

      <div class="space-y-2 theme-panel rounded-lg p-6">
        <h2 class="text-base font-medium">Assigned test types</h2>
        <div class="grid grid-cols-2 gap-1 md:grid-cols-3">
          <label v-for="t in testTypes" :key="t.id" class="flex items-center gap-2 text-sm">
            <input v-model="form.test_type_ids" type="checkbox" :value="t.id" />
            {{ t.name }}
          </label>
        </div>
      </div>

      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
        <Link href="/test-types/forms" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
