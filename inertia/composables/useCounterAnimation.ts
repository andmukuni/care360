import { onMounted, onUnmounted } from 'vue'

export function useCounterAnimation() {
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const duration = 1500
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

    const animateCounter = (el: HTMLElement) => {
      const target = parseInt(el.getAttribute('data-target') ?? '0', 10) || 0
      const startTime = performance.now()

      const update = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const current = Math.floor(target * easeOutQuart(progress))
        el.textContent = current.toLocaleString()
        if (progress < 1) {
          requestAnimationFrame(update)
        } else {
          el.textContent = target.toLocaleString()
        }
      }

      requestAnimationFrame(update)
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target as HTMLElement)
            observer?.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.counter-value').forEach((el) => observer?.observe(el))
  })

  onUnmounted(() => {
    observer?.disconnect()
  })
}
