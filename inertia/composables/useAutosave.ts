import { computed, onMounted, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  registerAutosave,
  unregisterAutosave,
  updateAutosave,
} from '~/composables/useAutosaveRegistry'
import { readXsrfToken } from '~/support/xsrf'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export type UseAutosaveOptions = {
  url: string
  getPayload: () => Record<string, unknown> | unknown | null
  enabled: Ref<boolean> | ComputedRef<boolean>
  debounceMs?: number
  watchSource?: Ref<unknown> | ComputedRef<unknown>
  onSaved?: (payload: Record<string, unknown>, response?: Record<string, unknown>) => void
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value)
}

export function useAutosave(options: UseAutosaveOptions) {
  const debounceMs = options.debounceMs ?? 2000
  const status = ref<AutosaveStatus>('idle')
  const lastSavedAt = ref<Date | null>(null)
  const errorMessage = ref<string | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let queued = false
  let lastSavedPayload = ''
  let abortController: AbortController | null = null
  let registryId: number | null = null

  function syncRegistry() {
    if (registryId === null) return
    updateAutosave(registryId, {
      status: status.value,
      text: indicatorText.value,
      errorMessage: errorMessage.value,
    })
  }

  function clearDebounce() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  async function performSave() {
    if (!options.enabled.value) return

    const payload = options.getPayload()
    if (payload == null) {
      status.value = lastSavedAt.value ? 'saved' : 'idle'
      return
    }
    const serialized = stableSerialize(payload)
    if (serialized === lastSavedPayload) {
      status.value = lastSavedAt.value ? 'saved' : 'idle'
      return
    }

    if (inFlight) {
      queued = true
      return
    }

    inFlight = true
    status.value = 'saving'
    errorMessage.value = null
    abortController?.abort()
    abortController = new AbortController()

    try {
      const res = await fetch(options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-XSRF-TOKEN': readXsrfToken(),
        },
        body: serialized,
        signal: abortController.signal,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.ok === false) {
        status.value = 'error'
        const validationMessage = Array.isArray(data.errors)
          ? data.errors.find((entry: { message?: string }) => entry?.message)?.message
          : null
        errorMessage.value = data.message ?? validationMessage ?? `Save failed (${res.status})`
        return
      }

      lastSavedPayload = serialized
      lastSavedAt.value = data.saved_at ? new Date(data.saved_at) : new Date()
      status.value = 'saved'
      if (options.onSaved && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        options.onSaved(payload as Record<string, unknown>, data as Record<string, unknown>)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Save failed'
    } finally {
      inFlight = false
      if (queued) {
        queued = false
        void performSave()
      }
    }
  }

  function scheduleSave() {
    if (!options.enabled.value) return
    status.value = 'pending'
    clearDebounce()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void performSave()
    }, debounceMs)
  }

  function markDirty() {
    scheduleSave()
  }

  async function saveNow(): Promise<boolean> {
    clearDebounce()
    await performSave()
    return status.value === 'saved'
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (
      status.value === 'saving' ||
      status.value === 'pending' ||
      status.value === 'error' ||
      queued ||
      inFlight
    ) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  if (options.watchSource) {
    watch(options.watchSource, scheduleSave, { deep: true })
  }

  watch(options.enabled, (enabled) => {
    if (!enabled) clearDebounce()
  })

  const indicatorText = computed(() => {
    switch (status.value) {
      case 'pending':
        return 'Unsaved changes…'
      case 'saving':
        return 'Saving…'
      case 'saved':
        return lastSavedAt.value
          ? `Saved ${lastSavedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Saved'
      case 'error':
        return errorMessage.value ?? 'Save failed'
      default:
        return ''
    }
  })

  watch([status, indicatorText, errorMessage], syncRegistry)

  onMounted(() => {
    registryId = registerAutosave({
      status: status.value,
      text: indicatorText.value,
      errorMessage: errorMessage.value,
      retry: saveNow,
    })
    window.addEventListener('beforeunload', onBeforeUnload)
  })

  onUnmounted(() => {
    if (registryId !== null) unregisterAutosave(registryId)
    clearDebounce()
    abortController?.abort()
    window.removeEventListener('beforeunload', onBeforeUnload)
  })

  return {
    status,
    lastSavedAt,
    errorMessage,
    indicatorText,
    markDirty,
    saveNow,
    scheduleSave,
  }
}
