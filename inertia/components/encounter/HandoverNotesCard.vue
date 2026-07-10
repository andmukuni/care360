<script setup lang="ts">
defineProps<{
  handover: {
    notes: string | null
    queued_by_name: string | null
    queued_at: string | null
  }
}>()
</script>

<template>
  <div class="mb-4 overflow-hidden rounded-lg border border-sky-200 bg-sky-50">
    <div class="flex items-center gap-2 border-b border-sky-200 bg-sky-100 px-4 py-2.5">
      <svg class="h-3.5 w-3.5 shrink-0 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      <span class="text-xs font-bold uppercase tracking-wide text-sky-700">Handover Notes</span>
    </div>
    <div class="px-4 py-3">
      <p v-if="handover.notes" class="text-sm leading-relaxed text-sky-900">{{ handover.notes }}</p>
      <p v-else class="text-sm italic text-sky-400">No handover notes provided for this queue stage.</p>
      <div v-if="handover.queued_by_name || handover.queued_at" class="mt-2 flex items-center gap-1.5 text-xs text-sky-500">
        <svg class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span v-if="handover.queued_by_name" class="font-semibold text-sky-700">{{ handover.queued_by_name }}</span>
        <span v-if="handover.queued_at" class="text-sky-400">·</span>
        <span v-if="handover.queued_at">{{ handover.queued_at }}</span>
      </div>
    </div>
  </div>
</template>
