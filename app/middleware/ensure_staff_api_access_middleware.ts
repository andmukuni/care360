import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

/**
 * Staff counterpart of EnsurePatientApiPortalActive. Ported from
 * App\Http\Middleware\EnsureStaffApiAccess.
 *
 * Ensures a staff route only ever runs for an actual User. A non-staff token
 * (e.g. a patient token) presented to a staff route is rejected and burned so
 * it cannot be probed against staff endpoints.
 */
export default class EnsureStaffApiAccessMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const user = ctx.auth.user

    if (!(user instanceof User)) {
      // A non-staff token was presented to a staff route. Burn it if we can.
      const authenticated = user as { currentAccessToken?: { identifier: string | number | BigInt }; constructor?: any } | undefined
      const token = authenticated?.currentAccessToken
      const provider = authenticated?.constructor?.accessTokens
      if (token && provider && typeof provider.delete === 'function') {
        await provider.delete(authenticated, token.identifier)
      }

      return ctx.response.unauthorized({ message: 'Unauthenticated.' })
    }

    return next()
  }
}
