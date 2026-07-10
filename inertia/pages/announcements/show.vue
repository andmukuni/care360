<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface Announcement {
  id: number
  title: string
  message: string
  status: string
  audience: string
  target_roles: string[]
  author: string | null
  published_at: string | null
  published_at_human: string | null
}

const props = defineProps<{ announcement: Announcement }>()

const statusClass: Record<string, string> = {
  general: 'bg-blue-100 text-blue-700',
  urgent: 'bg-amber-100 text-amber-700',
  follow_up: 'bg-green-100 text-green-700',
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Announcement</h1></template>

    <article class="max-w-2xl space-y-4 theme-panel rounded-lg p-6">
      <div class="flex items-center gap-2">
        <span class="rounded px-2 py-0.5 text-xs" :class="statusClass[props.announcement.status] ?? 'bg-sand-3'">
          {{ props.announcement.status }}
        </span>
        <span class="text-xs text-sand-11">{{ props.announcement.published_at_human }}</span>
      </div>
      <h2 class="text-xl font-semibold">{{ props.announcement.title }}</h2>
      <p class="whitespace-pre-line text-sm leading-relaxed">{{ props.announcement.message }}</p>
      <div class="border-t border-sand-6 pt-3 text-sm text-sand-11">
        <span v-if="props.announcement.author">Posted by {{ props.announcement.author }}</span>
      </div>
      <div>
        <Link href="/announcements/manage" class="text-sm text-blue-600 hover:underline">← Back to announcements</Link>
      </div>
    </article>
  </StaffLayout>
</template>
