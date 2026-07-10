<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  bed: {
    id: number
    wardId: number
    bedNumber: string
    status: string
    notes: string | null
    isActive: boolean
  }
  wards: { id: number; name: string; wing: string }[]
  statuses: string[]
}>()

const form = useForm({
  ward_id: props.bed.wardId,
  bed_number: props.bed.bedNumber,
  status: props.bed.status,
  notes: props.bed.notes ?? '',
  is_active: props.bed.isActive,
})

function submit() {
  form.put(`/beds/${props.bed.id}`)
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Edit Bed</h1></template>

    <form class="max-w-lg space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Ward</label>
        <select v-model="form.ward_id" class="theme-field w-full rounded px-3 py-2">
          <option v-for="w in wards" :key="w.id" :value="w.id">{{ w.name }} ({{ w.wing }})</option>
        </select>
        <p v-if="form.errors.ward_id" class="mt-1 text-sm text-red-600">{{ form.errors.ward_id }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Bed number</label>
        <input v-model="form.bed_number" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.bed_number" class="mt-1 text-sm text-red-600">{{ form.errors.bed_number }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Status</label>
        <select v-model="form.status" class="w-full rounded border border-sand-6 px-3 py-2 capitalize">
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
        <p v-if="form.errors.status" class="mt-1 text-sm text-red-600">{{ form.errors.status }}</p>
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
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Update</ActionButton>
        <Link href="/beds" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
