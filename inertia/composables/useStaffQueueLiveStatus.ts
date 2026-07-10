import { readonly, ref } from 'vue'
import { staffTransmit } from '~/lib/staff_transmit'

export type QueueLiveStatus = 'live' | 'connecting' | 'offline'

const status = ref<QueueLiveStatus>('connecting')
let wired = false

function mapTransmitEvent(eventName: string): QueueLiveStatus {
  if (eventName === 'connected') {
    return 'live'
  }

  if (eventName === 'disconnected') {
    return 'offline'
  }

  return 'connecting'
}

function ensureWired() {
  if (wired) {
    return
  }

  wired = true

  try {
    const transmit = staffTransmit()
    const update = (event: Event) => {
      status.value = mapTransmitEvent(event.type)
    }

    transmit.on('connected', update)
    transmit.on('disconnected', update)
    transmit.on('reconnecting', update)
    transmit.on('initializing', update)
  } catch {
    status.value = 'offline'
  }
}

export function useStaffQueueLiveStatus() {
  ensureWired()
  return { status: readonly(status) }
}
