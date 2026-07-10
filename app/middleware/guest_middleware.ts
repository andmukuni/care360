import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Guest middleware is used to deny access to routes that should
 * be accessed by unauthenticated users.
 *
 * For example, the login page should not be accessible if the user
 * is already logged-in.
 *
 * Authenticated users are redirected the same way Laravel's redirectUsersTo did
 * (bootstrap/app.php): on portal URLs to the portal home, everywhere else to
 * the staff dashboard.
 */
export default class GuestMiddleware {
  private redirectFor(ctx: HttpContext): string {
    const path = ctx.request.url()
    if (path === '/portal' || path.startsWith('/portal/')) {
      return '/portal'
    }

    return '/dashboard'
  }

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: (keyof Authenticators)[] } = {}
  ) {
    for (let guard of options.guards || [ctx.auth.defaultGuard]) {
      if (await ctx.auth.use(guard).check()) {
        return ctx.response.redirect(this.redirectFor(ctx), true)
      }
    }

    return next()
  }
}
