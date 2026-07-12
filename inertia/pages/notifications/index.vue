<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TableIconButton from '~/components/staff/TableIconButton.vue'
import TableIconLink from '~/components/staff/TableIconLink.vue'

interface NotificationItem {
  id: string
  type: string
  data: Record<string, any>
  read: boolean
  read_at: string | null
  created_at: string | null
  created_at_human: string | null
}

const props = defineProps<{
  notifications: NotificationItem[]
  unreadCount: number
}>()

function markRead(item: NotificationItem) {
  router.post(`/notifications/${item.id}/read`, {}, { preserveScroll: true })
}

function markAllRead() {
  router.post('/notifications/read-all', {}, { preserveScroll: true })
}

function dismiss(item: NotificationItem) {
  router.delete(`/notifications/${item.id}`, { preserveScroll: true })
}

function severityClass(item: NotificationItem): string {
  switch (item.data.type) {
    case 'warning':
      return 'border-l-4 border-amber-500'
    case 'success':
      return 'border-l-4 border-green-500'
    default:
      return 'border-l-4 border-blue-500'
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Notifications</h1></template>

    <div class="mb-4 flex items-center justify-between">
      <span class="text-sm text-sand-11">{{ props.unreadCount }} unread</span>
      <button
        v-if="props.unreadCount > 0"
        type="button"
        class="theme-icon-btn rounded px-3 py-1.5 text-sm"
        @click="markAllRead"
      >
        Mark all as read
      </button>
    </div>

    <div v-if="!props.notifications.length" class="theme-panel rounded-lg p-8 text-center text-sand-11">
      You have no notifications.
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="item in props.notifications"
        :key="item.id"
        class="theme-surface rounded-lg p-4"
        :class="[severityClass(item), item.read ? 'opacity-70' : '']"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ item.data.title ?? 'Notification' }}</span>
              <span v-if="!item.read" class="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">New</span>
            </div>
            <p class="mt-1 text-sm text-sand-11">{{ item.data.message }}</p>
            <a
              v-if="item.data.link"
              :href="item.data.link"
              class="mt-1 line-clamp-1 text-xs text-neutral-500"
            >
              {{ item.data.link }}
            </a>
            <div class="mt-1 text-xs text-sand-11">{{ item.created_at_human }}</div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <div class="table-action-group">
              <TableIconLink
                v-if="item.data.link"
                :href="item.data.link"
                variant="open"
                title="Open notification link"
              />
              <TableIconButton
                v-if="!item.read"
                variant="check"
                title="Mark as read"
                @click="markRead(item)"
              />
              <TableIconButton
                variant="delete"
                tone="danger"
                title="Dismiss notification"
                @click="dismiss(item)"
              />
            </div>
          </div>
        </div>
      </li>
    </ul>
  </StaffLayout>
</template>
