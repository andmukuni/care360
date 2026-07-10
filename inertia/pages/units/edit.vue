<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  unit: { id: number; name: string; form: string | null; strength: string | null }
}>()

const form = useForm({ name: props.unit.name })

function submit() {
  form.put(`/units/${props.unit.id}`)
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Edit Unit</h1></template>

    <form class="max-w-lg space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Name (form + strength)</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Update</ActionButton>
        <Link href="/units" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
