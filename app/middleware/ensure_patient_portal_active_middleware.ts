import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Web portal guard. Ported from App\Http\Middleware\EnsurePatientPortalActive.
 *
 * If a patient session exists but the account is no longer portal-eligible
 * (portal disabled, deceased, or non-active status), the session is torn down
 * and the patient is bounced to the portal login with an error message.
 */
export default class EnsurePatientPortalActiveMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    await ctx.auth.use('patient').check()
    const patient = ctx.auth.use('patient').user

    if (!patient) {
      return next()
    }

    if (
      !patient.portalEnabled ||
      patient.isDeceased ||
      (patient.status && patient.status !== 'active')
    ) {
      await ctx.auth.use('patient').logout()
      ctx.session.regenerate()

      ctx.session.flashErrors({
        email: 'Your portal access is no longer available. Please contact the hospital.',
      })

      return ctx.response.redirect('/portal/login')
    }

    return next()
  }
}
