<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

interface NotificationRow {
  id: string
  readAt: string | null
  createdAt: string | null
  data: { title?: string; message?: string; link?: string }
}

const props = defineProps<{
  patient: Record<string, any>
  notifications: { data: NotificationRow[]; meta: Record<string, any> }
}>()

// Local, mutable copy so "mark read" can update the UI without a full reload.
const rows = ref<NotificationRow[]>(props.notifications.data.map((n) => ({ ...n })))
const unreadCount = computed(() => rows.value.filter((n) => !n.readAt).length)

function relativeTime(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

async function markRead(notification: NotificationRow) {
  const token = readCookie('XSRF-TOKEN')
  await fetch(`/portal/notifications/${notification.id}/read`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { 'X-XSRF-TOKEN': token } : {}),
    },
  })
  notification.readAt = new Date().toISOString()
}

function markAllRead() {
  router.post('/portal/notifications/read-all', {}, { preserveScroll: true })
}
</script>

<template>
  <PortalLayout>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Notifications</h1>
      <button v-if="unreadCount > 0" type="button" @click="markAllRead"
              class="text-xs font-semibold text-neutral-600 underline">
        Mark all read
      </button>
    </div>

    <div class="rounded-xl theme-surface overflow-hidden">
      <div v-for="notification in rows" :key="notification.id"
           class="px-4 py-3 border-b border-neutral-100 last:border-0" :class="{ 'opacity-70': notification.readAt }">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">{{ notification.data.title ?? 'Notification' }}</p>
            <p class="text-sm text-neutral-600 mt-0.5">{{ notification.data.message ?? '' }}</p>
            <p class="text-xs text-neutral-400 mt-1">{{ relativeTime(notification.createdAt) }}</p>
            <a v-if="notification.data.link" :href="notification.data.link"
               class="text-xs font-semibold text-neutral-700 underline mt-1 inline-block">View details</a>
          </div>
          <button v-if="!notification.readAt" type="button" @click="markRead(notification)"
                  class="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200">
            Mark read
          </button>
        </div>
      </div>
      <div v-if="!rows.length" class="px-4 py-10 text-center">
        <p class="text-sm font-semibold text-neutral-700">No notifications yet</p>
        <p class="text-xs text-neutral-500 mt-1">Updates about appointments, results, and billing will appear here.</p>
      </div>
    </div>

    <div v-if="notifications.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <Link v-if="notifications.meta.currentPage > 1" :href="`/portal/notifications?page=${notifications.meta.currentPage - 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">← Previous</Link>
      <span v-else></span>
      <span class="text-neutral-500">Page {{ notifications.meta.currentPage }} of {{ notifications.meta.lastPage }}</span>
      <Link v-if="notifications.meta.currentPage < notifications.meta.lastPage" :href="`/portal/notifications?page=${notifications.meta.currentPage + 1}`"
            class="font-semibold text-neutral-700 hover:text-neutral-900">Next →</Link>
      <span v-else></span>
    </div>
  </PortalLayout>
</template>
