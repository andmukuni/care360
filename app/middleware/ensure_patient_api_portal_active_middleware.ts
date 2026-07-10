import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Patient from '#models/patient'

/**
 * Token-auth counterpart of EnsurePatientPortalActive. Ported from
 * App\Http\Middleware\EnsurePatientApiPortalActive.
 *
 * Re-checks portal eligibility for the token owner and revokes the presented
 * token when access has been withdrawn. A pending self-registration (portal not
 * yet enabled) keeps its token but is denied full-access endpoints.
 */
export default class EnsurePatientApiPortalActiveMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const patient = ctx.auth.user

    if (!(patient instanceof Patient)) {
      return ctx.response.unauthorized({ message: 'Unauthenticated.' })
    }

    if (patient.isDeceased || (patient.status && patient.status !== 'active')) {
      // Burn the presented token so a withdrawn account cannot keep using it.
      const token = patient.currentAccessToken
      if (token) {
        await Patient.accessTokens.delete(patient, token.identifier)
      }

      return ctx.response.forbidden({
        message: 'Your portal access is no longer available. Please contact the hospital.',
      })
    }

    if (!patient.portalEnabled) {
      // Self-registration awaiting staff approval. Keep the token alive so the
      // app can keep polling /me; just deny the full-access endpoints.
      return ctx.response.forbidden({
        message: 'Your account is awaiting approval by the hospital.',
        approval_status: 'pending',
      })
    }

    return next()
  }
}
