import { onMounted, onUnmounted, ref } from 'vue'

export const THEME_CHANGE_EVENT = 'hms-theme-change'

export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export function toggleTheme(): boolean {
  const nextDark = document.documentElement.classList.toggle('dark')
  document.documentElement.classList.toggle('light', !nextDark)
  localStorage.setItem('hms-theme', nextDark ? 'dark' : 'light')
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { isDark: nextDark } }))
  return nextDark
}

export function useTheme() {
  const isDark = ref(isDarkMode())

  function sync() {
    isDark.value = isDarkMode()
  }

  let observer: MutationObserver | null = null

  onMounted(() => {
    sync()
    window.addEventListener(THEME_CHANGE_EVENT, sync)
    observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })

  onUnmounted(() => {
    window.removeEventListener(THEME_CHANGE_EVENT, sync)
    observer?.disconnect()
  })

  function toggle() {
    toggleTheme()
    sync()
  }

  return { isDark, toggle, sync }
}
