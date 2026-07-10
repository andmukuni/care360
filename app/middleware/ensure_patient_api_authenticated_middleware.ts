import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Patient from '#models/patient'

/**
 * Lighter portal-API guard for endpoints a patient awaiting approval may still
 * call (identity + sign-out). Ported from
 * App\Http\Middleware\EnsurePatientApiAuthenticated.
 *
 * Unlike EnsurePatientApiPortalActive this does NOT require portal_enabled, so
 * a pending self-registration can read its own /me and poll for approval. It
 * still blocks non-patient (staff) tokens and revokes the token of a
 * deceased / non-active record.
 */
export default class EnsurePatientApiAuthenticatedMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const patient = ctx.auth.user

    if (!(patient instanceof Patient)) {
      return ctx.response.unauthorized({ message: 'Unauthenticated.' })
    }

    if (patient.isDeceased || (patient.status && patient.status !== 'active')) {
      // Genuinely blocked — burn the token so it can't be reused.
      const token = patient.currentAccessToken
      if (token) {
        await Patient.accessTokens.delete(patient, token.identifier)
      }

      return ctx.response.forbidden({
        message: 'Your portal access is no longer available. Please contact the hospital.',
      })
    }

    return next()
  }
}
