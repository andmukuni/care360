import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'
import { cachedSessionUserProvider } from '#services/auth/cached_session_user_provider'

const authConfig = defineConfig({
  default: 'web',
  guards: {
    /**
     * Staff session guard (browser app). Ported from Laravel's `web` guard.
     */
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: cachedSessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),

    /**
     * Patient portal session guard. Ported from Laravel's `patient` guard.
     */
    patient: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/patient'),
      }),
    }),

    /**
     * Staff JSON API guard (Sanctum-style bearer tokens). Backed by the
     * `personal_access_tokens` table via User.accessTokens.
     */
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/user'),
      }),
    }),

    /**
     * Patient JSON/mobile API guard. Backed by the same
     * `personal_access_tokens` table via Patient.accessTokens.
     */
    patient_api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/patient'),
      }),
    }),
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
