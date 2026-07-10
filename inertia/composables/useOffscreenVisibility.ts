import { inject, onMounted, onUnmounted, ref, type Ref } from 'vue'

export const STAFF_MAIN_SCROLL_KEY = Symbol('staffMainScroll')

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement

  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }

  return null
}

/**
 * True when the entire target is visible inside the scroll container viewport.
 */
export function isFullyVisibleInScrollRoot(target: HTMLElement, scrollRoot: HTMLElement): boolean {
  const rootRect = scrollRoot.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const margin = 4

  return (
    targetRect.top >= rootRect.top + margin &&
    targetRect.bottom <= rootRect.bottom - margin &&
    targetRect.height > 0
  )
}

/**
 * Tracks whether a target element is fully visible inside the staff main scroll area.
 */
export function useOffscreenVisibility(targetRef: Ref<HTMLElement | null>) {
  const isVisible = ref(true)
  const injectedScrollRoot = inject<Ref<HTMLElement | null>>(STAFF_MAIN_SCROLL_KEY, ref(null))
  let scrollRoot: HTMLElement | null = null
  let rafId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  function resolveScrollRoot(target: HTMLElement): HTMLElement | null {
    return injectedScrollRoot.value ?? findScrollParent(target)
  }

  function updateVisibility() {
    const target = targetRef.value
    if (!target || !scrollRoot) {
      return
    }

    isVisible.value = isFullyVisibleInScrollRoot(target, scrollRoot)
  }

  function scheduleUpdate() {
    if (rafId !== null) {
      return
    }

    rafId = requestAnimationFrame(() => {
      rafId = null
      updateVisibility()
    })
  }

  onMounted(() => {
    const target = targetRef.value
    if (!target) {
      return
    }

    scrollRoot = resolveScrollRoot(target)
    if (!scrollRoot) {
      return
    }

    scrollRoot.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    resizeObserver = new ResizeObserver(() => scheduleUpdate())
    resizeObserver.observe(scrollRoot)
    resizeObserver.observe(target)

    scheduleUpdate()
  })

  onUnmounted(() => {
    scrollRoot?.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
    resizeObserver?.disconnect()
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  })

  return { isVisible }
}
