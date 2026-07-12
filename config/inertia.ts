import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import StaffSidebarService from '#services/staff_sidebar_service'
import ClinicSettings from '#support/clinic_settings'

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data shared with all rendered Inertia pages. Mirrors the globals the
   * Laravel Blade layouts relied on (auth user, permissions, flash messages).
   */
  sharedData: {
    currentUser: (ctx) => {
      const user = ctx.auth?.user as any
      if (!user) return null
      return {
        id: user.id,
        name: user.name ?? user.fullName ?? null,
        email: user.email ?? null,
      }
    },
    permissions: (ctx) => ((ctx as any).authPermissionNames ?? []),
    // Named authRoles (not roles) so page props like access-control role catalogs
    // cannot override the signed-in user's role names and break the shell UI.
    authRoles: (ctx) => ((ctx as any).authRoleNames ?? []),
    flash: (ctx) => ({
      success: ctx.session?.flashMessages.get('success') ?? null,
      error: ctx.session?.flashMessages.get('error') ?? null,
    }),
    errors: (ctx) => ctx.session?.flashMessages.get('errors') ?? {},
    clinic: async () => ClinicSettings.branding(),
    navBadges: async (ctx) => {
      if (!ctx.auth?.user) {
        return {
          stageCounts: {},
          pendingAppointmentCount: 0,
          pendingKycCount: 0,
        }
      }
      return StaffSidebarService.navBadges()
    },
  },

  /**
   * Options for the server-side rendering. Disabled for now (client-side
   * rendering only) per the migration plan; can be enabled later.
   */
  ssr: {
    enabled: false,
    entrypoint: 'inertia/app/ssr.ts',
  },
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}