import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export type ToastItem = {
  id: number
  type: ToastType
  message: string
}

const toasts = ref<ToastItem[]>([])
let nextId = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function dismiss(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function push(type: ToastType, message: string, durationMs = 5000) {
  const trimmed = message.trim()
  if (!trimmed) return

  const id = ++nextId
  toasts.value.push({ id, type, message: trimmed })

  const timer = setTimeout(() => dismiss(id), durationMs)
  timers.set(id, timer)
}

export function useToast() {
  return {
    toasts,
    success: (message: string, durationMs?: number) => push('success', message, durationMs ?? 5000),
    error: (message: string, durationMs?: number) => push('error', message, durationMs ?? 6500),
    info: (message: string, durationMs?: number) => push('info', message, durationMs ?? 5000),
    warning: (message: string, durationMs?: number) => push('warning', message, durationMs ?? 6000),
    dismiss,
  }
}

export type FlashPayload = {
  success?: string | null
  error?: string | null
}

const recentFlashKeys = new Set<string>()

function showOnce(type: ToastType, message: string, durationMs?: number) {
  const key = `${type}:${message}`
  if (recentFlashKeys.has(key)) return
  recentFlashKeys.add(key)
  setTimeout(() => recentFlashKeys.delete(key), 400)
  push(type, message, durationMs)
}

export function processFlashMessages(flash: FlashPayload | null | undefined) {
  if (!flash) return
  if (typeof flash.success === 'string' && flash.success.trim()) {
    showOnce('success', flash.success)
  }
  if (typeof flash.error === 'string' && flash.error.trim()) {
    showOnce('error', flash.error)
  }
}
