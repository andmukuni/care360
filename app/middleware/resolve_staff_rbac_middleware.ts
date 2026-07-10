import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import RbacService from '#services/auth/rbac_service'

/**
 * Resolve staff RBAC once per request so Inertia shared props and controllers
 * do not each re-query roles/permissions against the remote database.
 */
export default class ResolveStaffRbacMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (user && ctx.authRoleNames === undefined) {
      const snapshot = await RbacService.snapshot(user)
      ctx.authRoleNames = snapshot.roleNames
      ctx.authPermissionNames = snapshot.permissionNames
    }

    return next()
  }
}
