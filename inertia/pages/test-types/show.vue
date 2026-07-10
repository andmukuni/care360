<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

defineProps<{
  testType: {
    id: number
    name: string
    description: string | null
    isActive: boolean
    specimenType: { id: number; name: string; testCategory: string | null } | null
    resultForm: { id: number; label: string } | null
  }
}>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Test Type: {{ testType.name }}</h1></template>

    <div class="max-w-lg theme-panel rounded-lg p-6 space-y-3">
      <div><span class="text-sand-11 text-sm">Sample type:</span> {{ testType.specimenType?.name ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Sample category:</span> {{ testType.specimenType?.testCategory ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Result form:</span> {{ testType.resultForm?.label ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Discipline:</span> {{ testType.description ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Active:</span> {{ testType.isActive ? 'Yes' : 'No' }}</div>
      <div class="flex gap-2 pt-2">
        <Link :href="`/test-types/${testType.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
        <Link href="/test-types" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
      </div>
    </div>
  </StaffLayout>
</template>
