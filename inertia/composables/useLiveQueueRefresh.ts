import { onMounted, onUnmounted, shallowRef } from 'vue'
import { router } from '@inertiajs/vue3'
import type { Subscription } from '@adonisjs/transmit-client'
import { staffTransmit } from '~/lib/staff_transmit'

export type StaffQueueBroadcastPayload = {
  stages?: string[]
}

const RELOAD_DEBOUNCE_MS = 250

async function safeDeleteSubscription(subscription: Subscription) {
  try {
    await subscription.delete()
  } catch {
    /* Transmit Subscription uses private fields — ignore teardown races */
  }
}

/**
 * Subscribes to staff queue SSE events and reloads selected Inertia props when
 * a watched stage changes on another session.
 */
export function useLiveQueueRefresh(options: { stages: string[]; only: string[] }) {
  // shallowRef: Subscription has private fields that break under Vue reactive proxies
  const subscriptionRef = shallowRef<Subscription | null>(null)
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

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

  onMounted(() => {
    const connect = async () => {
      if (disposed) {
        return
      }

      try {
        const subscription = staffTransmit().subscription('staff/queues')
        if (disposed) {
          return
        }

        subscriptionRef.value = subscription
        await subscription.create()

        if (disposed) {
          subscriptionRef.value = null
          await safeDeleteSubscription(subscription)
          return
        }

        subscription.onMessage(onQueueMessage)
      } catch {
        /* Live queue updates unavailable — page still works without SSE */
      }
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        void connect()
      })
    } else {
      window.setTimeout(() => {
        void connect()
      }, 0)
    }
  })

  onUnmounted(() => {
    disposed = true

    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    const subscription = subscriptionRef.value
    subscriptionRef.value = null
    if (subscription) {
      void safeDeleteSubscription(subscription)
    }
  })
}
