import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

/**
 * Staff users flagged with must_change_password must visit the welcome
 * password page and either set a new password or explicitly keep the current
 * one before using the rest of the app.
 */
export default class EnsurePasswordDecisionMiddleware {
  private allowedPrefixes = ['/password/welcome', '/logout', '/session/']

  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user as User | undefined
    if (!user?.mustChangePassword) {
      return next()
    }

    const path = ctx.request.url()
    const allowed = this.allowedPrefixes.some(
      (prefix) => path === prefix || path.startsWith(prefix)
    )
    if (allowed) {
      return next()
    }

    return ctx.response.redirect('/password/welcome')
  }
}
