/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import '../css/app.css';
import '../css/staff-dashboard.css';
import { createApp, h } from 'vue'
import type { DefineComponent } from 'vue'
import { createInertiaApp, router } from '@inertiajs/vue3'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { readXsrfToken } from '~/support/xsrf'
import NavigationSpinner from '~/components/ui/NavigationSpinner.vue'
import ToastContainer from '~/components/ui/ToastContainer.vue'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import { initNavigationLoading } from '~/composables/useNavigationLoading'
import { hasBlockingAutosaveState } from '~/composables/useAutosaveRegistry'
import { confirmDialog } from '~/composables/useConfirm'
import { installFlashToasts, processInitialFlash } from '~/support/flash_toasts'

const CLINIC_BRANDING_KEY = 'hms-clinic-branding'

function persistClinicBranding(page: { props?: Record<string, unknown> } | undefined) {
  const clinic = page?.props?.clinic as
    | { name?: string; logoUrl?: string | null; hideLogo?: boolean }
    | undefined
  if (!clinic?.name) return

  try {
    localStorage.setItem(
      CLINIC_BRANDING_KEY,
      JSON.stringify({
        name: clinic.name,
        logoUrl: clinic.logoUrl ?? null,
        hideLogo: clinic.hideLogo ?? false,
      })
    )
  } catch {
    /* localStorage unavailable */
  }
}

installFlashToasts()
initNavigationLoading()

let allowLeaveWithUnsaved = false

router.on('before', (event) => {
  const token = readXsrfToken()
  if (token) {
    event.detail.visit.headers = {
      ...event.detail.visit.headers,
      'X-XSRF-TOKEN': token,
    }
  }

  if (!hasBlockingAutosaveState()) return
  if (allowLeaveWithUnsaved) {
    allowLeaveWithUnsaved = false
    return
  }

  event.preventDefault()
  const visit = event.detail.visit
  void confirmDialog({
    title: 'Unsaved changes',
    message: 'You have unsaved changes that have not been saved. Leave this page anyway?',
    confirmLabel: 'Leave page',
    variant: 'danger',
  }).then((ok) => {
    if (!ok) return
    allowLeaveWithUnsaved = true
    router.visit(visit.url, visit)
  })
})

router.on('success', (event) => {
  persistClinicBranding(event.detail.page)
})

const appName = import.meta.env.VITE_APP_NAME || 'AdonisJS'

createInertiaApp({
  progress: { color: '#5468FF' },

  title: (title) => `${title} - ${appName}`,

  resolve: (name) => {
    return resolvePageComponent(
      `../pages/${name}.vue`,
      import.meta.glob<DefineComponent>('../pages/**/*.vue'),
    )
  },

  setup({ el, App, props, plugin }) {
    processInitialFlash(props.initialPage)
    persistClinicBranding(props.initialPage)

    createApp({
      render: () => [h(App, props), h(NavigationSpinner), h(ToastContainer), h(ConfirmDialog)],
    })
      .use(plugin)
      .mount(el)

    const boot = document.getElementById('app-boot')
    if (boot) {
      boot.classList.add('is-hidden')
      window.setTimeout(() => boot.remove(), 250)
    }
  },
})