<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

defineProps<{
  specimenType: {
    id: number
    name: string
    code: string | null
    defaultUnit: string | null
    testCategory: string | null
    sortOrder: number
    isActive: boolean
    linkedTests: number
  }
}>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Sample Type: {{ specimenType.name }}</h1></template>

    <div class="max-w-lg theme-panel rounded-lg p-6 space-y-3">
      <div><span class="text-sand-11 text-sm">Category:</span> {{ specimenType.testCategory ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Code:</span> {{ specimenType.code ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Default unit:</span> {{ specimenType.defaultUnit ?? '—' }}</div>
      <div><span class="text-sand-11 text-sm">Sort order:</span> {{ specimenType.sortOrder }}</div>
      <div><span class="text-sand-11 text-sm">Linked tests:</span> {{ specimenType.linkedTests }}</div>
      <div><span class="text-sand-11 text-sm">Active:</span> {{ specimenType.isActive ? 'Yes' : 'No' }}</div>
      <div class="flex gap-2 pt-2">
        <Link :href="`/lab/specimen-types/${specimenType.id}/edit`" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">Edit</Link>
        <Link href="/lab/specimen-types" class="theme-icon-btn rounded px-4 py-2 text-sm">Back</Link>
      </div>
    </div>
  </StaffLayout>
</template>
