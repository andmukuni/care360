import type { Page } from '@inertiajs/core'
import { router } from '@inertiajs/vue3'
import { processFlashMessages } from '~/composables/useToast'

export function installFlashToasts() {
  router.on('success', (event) => {
    const flash = (event.detail.page.props as { flash?: { success?: string | null; error?: string | null } }).flash
    processFlashMessages(flash)
  })
}

export function processInitialFlash(initialPage: Page) {
  const flash = (initialPage.props as { flash?: { success?: string | null; error?: string | null } }).flash
  processFlashMessages(flash)
}
