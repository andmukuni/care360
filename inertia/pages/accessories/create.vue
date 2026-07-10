<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  accessory: { status: string }
  types: { id: number; name: string }[]
  statuses: string[]
  wards: { id: number; name: string; wing: string; beds: { id: number; bedNumber: string }[] }[]
}>()

const form = useForm({
  accessory_type_id: props.types[0]?.id ?? null,
  asset_tag: '',
  name: '',
  bed_id: null as number | null,
  status: props.accessory.status,
  notes: '',
})

function submit() {
  form.post('/accessories')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">New Accessory</h1></template>

    <form class="max-w-lg space-y-4 theme-panel rounded-lg p-6" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1">Type</label>
        <select v-model="form.accessory_type_id" class="theme-field w-full rounded px-3 py-2">
          <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <p v-if="form.errors.accessory_type_id" class="mt-1 text-sm text-red-600">{{ form.errors.accessory_type_id }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Asset tag</label>
        <input v-model="form.asset_tag" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.asset_tag" class="mt-1 text-sm text-red-600">{{ form.errors.asset_tag }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Bed</label>
        <select v-model="form.bed_id" class="theme-field w-full rounded px-3 py-2">
          <option :value="null">In storage</option>
          <optgroup v-for="w in wards" :key="w.id" :label="`${w.name} (${w.wing})`">
            <option v-for="b in w.beds" :key="b.id" :value="b.id">{{ b.bedNumber }}</option>
          </optgroup>
        </select>
        <p v-if="form.errors.bed_id" class="mt-1 text-sm text-red-600">{{ form.errors.bed_id }}</p>
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
      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
        <Link href="/accessories" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
