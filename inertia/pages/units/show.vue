<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

defineProps<{
  unit: { id: number; name: string; form: string | null; strength: string | null }
}>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Unit: {{ unit.name }}</h1></template>

    <div class="max-w-lg theme-panel rounded-lg p-6 space-y-3">
      <div><span class="text-sand-11 text-sm">Name:</span> {{ unit.name }}</div>
      <div><span class="text-sand-11 text-sm">Form:</span> {{ unit.form ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Strength:</span> {{ unit.strength ?? '—' }}</div>
      <div class="flex gap-2 pt-2">
        <Link :href="`/units/${unit.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
        <Link href="/units" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
      </div>
    </div>
  </StaffLayout>
</template>
