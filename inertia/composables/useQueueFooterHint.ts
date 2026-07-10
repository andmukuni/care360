import { onMounted, ref } from 'vue'

export function useQueueFooterHint(stage: string, encounterId: number, variant?: string) {
  const storageKey = variant
    ? `${stage}-${variant}-queue-hint-dismissed-${encounterId}`
    : `${stage}-queue-hint-dismissed-${encounterId}`

  function shouldShow(): boolean {
    if (typeof window === 'undefined') return true
    try {
      return !window.sessionStorage.getItem(storageKey)
    } catch {
      return true
    }
  }

  const showQueueHint = ref(true)

  onMounted(() => {
    showQueueHint.value = shouldShow()
  })

  function dismissQueueHint() {
    showQueueHint.value = false
    try {
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      /* ignore */
    }
  }

  return { showQueueHint, dismissQueueHint }
}
