<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  requests: { data: Array<Record<string, any>>; meta: Record<string, any> }
}>()

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function humanize(value: any): string {
  const s = String(value ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : ''
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Lab requests</h1>

    <div class="space-y-4">
      <Link v-for="request in requests.data" :key="request.id" :href="`/portal/lab-requests/${request.id}`"
            class="block rounded-xl theme-surface p-4 hover:border-neutral-300 transition">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-sm font-semibold">{{ request.requestNumber ?? 'Lab request' }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">
              {{ fmtDateTime(request.requestedAt) }}
              <template v-if="request.encounter"> · {{ request.encounter.encounterNumber }}</template>
            </p>
          </div>
          <span v-if="request.status" class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 shrink-0">
            {{ humanize(request.status) }}
          </span>
        </div>
        <ul v-if="(request.labRequestItems ?? []).length" class="text-sm space-y-1">
          <li v-for="item in request.labRequestItems" :key="item.id" class="text-neutral-700">
            {{ item.testName ?? 'Test' }}
            <span v-if="item.status" class="text-xs text-neutral-400">· {{ item.status }}</span>
          </li>
        </ul>
        <p v-if="request.requestNotes" class="text-xs text-neutral-500 mt-2">{{ request.requestNotes }}</p>
      </Link>
      <div v-if="!requests.data.length" class="theme-surface rounded-xl p-8 text-center">
        <p class="text-sm font-semibold text-neutral-700">No lab requests</p>
        <p class="text-xs text-neutral-500 mt-1">Lab test orders from your visits will appear here.</p>
      </div>
    </div>

    <div v-if="requests.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <Link v-if="requests.meta.currentPage > 1" :href="`/portal/lab-requests?page=${requests.meta.currentPage - 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
      <span v-else></span>
      <span class="text-neutral-500">Page {{ requests.meta.currentPage }} of {{ requests.meta.lastPage }}</span>
      <Link v-if="requests.meta.currentPage < requests.meta.lastPage" :href="`/portal/lab-requests?page=${requests.meta.currentPage + 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
      <span v-else></span>
    </div>
  </PortalLayout>
</template>
