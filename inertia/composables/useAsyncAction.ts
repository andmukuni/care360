import { ref } from 'vue'

type ActionHelpers = { done: () => void }

export function useAsyncAction<TId = number>() {
  const loading = ref(false)
  const processingId = ref<TId | null>(null)

  function run(action: (helpers: ActionHelpers) => void | Promise<void>) {
    if (loading.value) return
    loading.value = true
    const done = () => {
      loading.value = false
    }

    try {
      const result = action({ done })
      if (result instanceof Promise) {
        result.catch(() => {}).finally(done)
      }
    } catch {
      done()
    }
  }

  function runFor(id: TId, action: (helpers: ActionHelpers) => void | Promise<void>) {
    if (processingId.value !== null) return
    processingId.value = id
    const done = () => {
      processingId.value = null
    }

    try {
      const result = action({ done })
      if (result instanceof Promise) {
        result.catch(() => {}).finally(done)
      }
    } catch {
      done()
    }
  }

  return {
    loading,
    processingId,
    run,
    runFor,
  }
}
