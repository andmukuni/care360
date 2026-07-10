<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

defineProps<{
  medication: {
    id: number
    name: string
    unit: string | null
    genericName: string | null
    category: string
    form: string
    strength: string | null
    defaultRoute: string | null
    defaultFrequency: string | null
    isControlled: boolean
    isActive: boolean
    notes: string | null
  }
}>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">{{ medication.name }}</h1></template>

    <div class="max-w-lg theme-panel rounded-lg p-6 space-y-3">
      <div><span class="text-sand-11 text-sm">Generic:</span> {{ medication.genericName ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Category:</span> {{ medication.category }}</div>
      <div><span class="text-sand-11 text-sm">Form:</span> {{ medication.form }}</div>
      <div><span class="text-sand-11 text-sm">Unit:</span> {{ medication.unit ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Strength:</span> {{ medication.strength ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Default route:</span> {{ medication.defaultRoute ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Default frequency:</span> {{ medication.defaultFrequency ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Controlled:</span> {{ medication.isControlled ? 'Yes' : 'No' }}</div>
      <div><span class="text-sand-11 text-sm">Active:</span> {{ medication.isActive ? 'Yes' : 'No' }}</div>
      <div v-if="medication.notes" class="whitespace-pre-line"><span class="text-sand-11 text-sm">Notes:</span> {{ medication.notes }}</div>
      <div class="flex gap-2 pt-2">
        <Link :href="`/medications/${medication.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
        <Link href="/medications" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
      </div>
    </div>
  </StaffLayout>
</template>
