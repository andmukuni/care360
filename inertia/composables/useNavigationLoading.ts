import { readonly, ref } from 'vue'
import { router } from '@inertiajs/vue3'

const pendingUrl = ref<string | null>(null)
let initialized = false

export function normalizeNavUrl(url: string | URL): string {
  const path = url instanceof URL ? url.pathname : (url.split('?')[0]?.split('#')[0] ?? url)
  if (path !== '/' && path.endsWith('/')) {
    return path.slice(0, -1)
  }
  return path || '/'
}

function isPartialVisit(visit: { only?: string[]; prefetch?: boolean }) {
  return Boolean(visit.prefetch) || (visit.only?.length ?? 0) > 0
}

export function initNavigationLoading() {
  if (initialized) {
    return
  }
  initialized = true

  router.on('start', (event) => {
    const visit = event.detail.visit
    if (isPartialVisit(visit)) {
      return
    }

    pendingUrl.value = normalizeNavUrl(visit.url)
  })

  const clearPending = () => {
    pendingUrl.value = null
  }

  router.on('finish', clearPending)
  router.on('cancel', clearPending)
  router.on('error', clearPending)
}

export function useNavigationLoading() {
  initNavigationLoading()

  function markPending(href: string) {
    if (href === '#') {
      return
    }

    const target = normalizeNavUrl(href)
    if (target === normalizeNavUrl(window.location.pathname)) {
      return
    }

    pendingUrl.value = target
  }

  function isNavigatingTo(href: string): boolean {
    if (!pendingUrl.value || href === '#') {
      return false
    }

    return pendingUrl.value === normalizeNavUrl(href)
  }

  return {
    pendingUrl: readonly(pendingUrl),
    markPending,
    isNavigatingTo,
  }
}
