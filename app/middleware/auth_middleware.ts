import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 *
 * Guests are redirected the same way Laravel's redirectGuestsTo did
 * (bootstrap/app.php): portal URLs go to the portal login, everything else to
 * the staff login.
 */
export default class AuthMiddleware {
  /**
   * The default URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  private loginRouteFor(ctx: HttpContext): string {
    const path = ctx.request.url()
    if (path === '/portal' || path.startsWith('/portal/')) {
      return '/portal/login'
    }

    return this.redirectTo
  }

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.loginRouteFor(ctx) })
    return next()
  }
}
