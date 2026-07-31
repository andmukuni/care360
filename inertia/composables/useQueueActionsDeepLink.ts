import { onMounted } from 'vue'

/**
 * Opens the queue-actions target when the user lands from a queue page (?queue=1).
 */
export function useQueueActionsDeepLink(open: () => void, options?: { scrollTo?: string }) {
  onMounted(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('queue') !== '1') {
      return
    }

    open()

    if (options?.scrollTo) {
      requestAnimationFrame(() => {
        document.getElementById(options.scrollTo!)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      })
    }

    params.delete('queue')
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', nextUrl)
  })
}
