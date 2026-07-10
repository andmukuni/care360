import { onMounted, onUnmounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import type { Subscription } from '@adonisjs/transmit-client'
import { staffTransmit } from '~/lib/staff_transmit'

export type StaffQueueBroadcastPayload = {
  stages?: string[]
}

const RELOAD_DEBOUNCE_MS = 250

/**
 * Subscribes to staff queue SSE events and reloads selected Inertia props when
 * a watched stage changes on another session.
 */
export function useLiveQueueRefresh(options: { stages: string[]; only: string[] }) {
  const subscriptionRef = ref<Subscription | null>(null)
  let reloadTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleReload() {
    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    reloadTimer = setTimeout(() => {
      router.reload({
        only: options.only,
        preserveScroll: true,
        preserveState: true,
        showProgress: false,
      })
    }, RELOAD_DEBOUNCE_MS)
  }

  function onQueueMessage(data: StaffQueueBroadcastPayload) {
    const affectedStages = data.stages ?? []
    if (affectedStages.some((stage) => options.stages.includes(stage))) {
      scheduleReload()
    }
  }

  onMounted(async () => {
    try {
      const subscription = staffTransmit().subscription('staff/queues')
      subscriptionRef.value = subscription
      await subscription.create()
      subscription.onMessage(onQueueMessage)
    } catch {
      /* Live queue updates unavailable — page still works without SSE */
    }
  })

  onUnmounted(async () => {
    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    const subscription = subscriptionRef.value
    subscriptionRef.value = null
    if (subscription) {
      await subscription.delete()
    }
  })
}
