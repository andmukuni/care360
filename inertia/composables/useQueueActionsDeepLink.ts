import { onMounted } from 'vue'

/**
 * Opens the queue-actions modal when the user lands from a queue page (?queue=1).
 */
export function useQueueActionsDeepLink(open: () => void) {
  onMounted(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('queue') === '1') {
      open()
      params.delete('queue')
      const query = params.toString()
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  })
}
