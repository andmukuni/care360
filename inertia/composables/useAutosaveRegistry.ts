import { computed, reactive } from 'vue'
import type { AutosaveStatus } from '~/composables/useAutosave'

type RegistryEntry = {
  id: number
  status: AutosaveStatus
  text: string
  errorMessage: string | null
  retry: () => Promise<boolean>
}

const state = reactive({
  entries: new Map<number, RegistryEntry>(),
  nextId: 1,
})

function entryList() {
  return [...state.entries.values()]
}

function aggregateStatus(entries: RegistryEntry[]): AutosaveStatus {
  if (entries.some((entry) => entry.status === 'error')) return 'error'
  if (entries.some((entry) => entry.status === 'saving')) return 'saving'
  if (entries.some((entry) => entry.status === 'pending')) return 'pending'
  if (entries.some((entry) => entry.status === 'saved')) return 'saved'
  return 'idle'
}

function aggregateText(entries: RegistryEntry[], status: AutosaveStatus): string {
  if (status === 'error') {
    const failed = entries.filter((entry) => entry.status === 'error')
    return failed[0]?.text || failed[0]?.errorMessage || 'Save failed'
  }
  if (status === 'pending') return 'Unsaved changes…'
  if (status === 'saving') return 'Saving…'
  return ''
}

export function registerAutosave(entry: Omit<RegistryEntry, 'id'>) {
  const id = state.nextId++
  state.entries.set(id, { id, ...entry })
  return id
}

export function updateAutosave(id: number, partial: Partial<Omit<RegistryEntry, 'id'>>) {
  const current = state.entries.get(id)
  if (!current) return
  state.entries.set(id, { ...current, ...partial })
}

export function unregisterAutosave(id: number) {
  state.entries.delete(id)
}

export function getGlobalAutosaveSnapshot() {
  const entries = entryList()
  const status = aggregateStatus(entries)
  const text = aggregateText(entries, status)
  const visible = status === 'error' || status === 'pending' || status === 'saving'

  return { entries, status, text, visible }
}

export function hasBlockingAutosaveState() {
  const { status, visible } = getGlobalAutosaveSnapshot()
  return visible && (status === 'pending' || status === 'error' || status === 'saving')
}

export async function retryFailedAutosaves() {
  const failed = entryList().filter((entry) => entry.status === 'error')
  if (!failed.length) return false
  const results = await Promise.all(failed.map((entry) => entry.retry()))
  return results.every(Boolean)
}

export async function flushAllAutosaves() {
  const entries = entryList()
  if (!entries.length) return true
  const results = await Promise.all(entries.map((entry) => entry.retry()))
  return results.every(Boolean)
}

export function useGlobalAutosaveState() {
  const entries = computed(() => entryList())

  const globalStatus = computed(() => aggregateStatus(entries.value))

  const globalText = computed(() => aggregateText(entries.value, globalStatus.value))

  const visible = computed(
    () =>
      globalStatus.value === 'error' ||
      globalStatus.value === 'pending' ||
      globalStatus.value === 'saving'
  )

  const canRetry = computed(() => entries.value.some((entry) => entry.status === 'error'))

  async function retryAll() {
    return retryFailedAutosaves()
  }

  return {
    globalStatus,
    globalText,
    visible,
    canRetry,
    retryAll,
  }
}
