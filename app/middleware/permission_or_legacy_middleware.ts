import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

/**
 * Permission gate with a legacy escape hatch. Ported from
 * App\Http\Middleware\PermissionOrLegacyMiddleware.
 *
 * Behaviour:
 *  - Users with NO roles AND NO direct permissions are "legacy" accounts and
 *    pass through unconditionally (full access).
 *  - Otherwise the user must hold at least one of the pipe/comma-separated
 *    permissions passed to the middleware.
 *  - Role fallbacks: a request that only targets screening.* / screening-review.*
 *    permissions is allowed for screening(-review) clinicians; a request that
 *    only targets pharmacy.* permissions is allowed for pharmacists.
 *
 * The resolved role/permission name lists are stashed on the context for
 * downstream consumers (ctx.authRoleNames / ctx.authPermissionNames).
 */
export default class PermissionOrLegacyMiddleware {
  private isScreeningFlowPermission(permission: string): boolean {
    return permission.startsWith('screening.') || permission.startsWith('screening-review.')
  }

  private isPharmacyFlowPermission(permission: string): boolean {
    return permission.startsWith('pharmacy.')
  }

  async handle(ctx: HttpContext, next: NextFn, options: { permissions: string }): Promise<void> {
    const user = ctx.auth.user

    if (!(user instanceof User)) {
      return ctx.response.abort('Forbidden', 403)
    }

    const roleNames = await user.getRoleNames()
    const permissionNames = await user.getPermissionNames()

    ctx.authRoleNames = roleNames
    ctx.authPermissionNames = permissionNames

    const isLegacyUserWithoutRbac = roleNames.length === 0 && permissionNames.length === 0

    if (isLegacyUserWithoutRbac) {
      return next()
    }

    const requiredPermissions = (options.permissions ?? '')
      .split(/[|,]/)
      .map((permission) => permission.trim())
      .filter((permission) => permission !== '')

    const hasRequiredPermission =
      requiredPermissions.length === 0 ||
      requiredPermissions.some((permission) => permissionNames.includes(permission))

    if (hasRequiredPermission) {
      return next()
    }

    const isScreeningFlowRequest = requiredPermissions.every((permission) =>
      this.isScreeningFlowPermission(permission)
    )

    if (
      isScreeningFlowRequest &&
      (roleNames.includes('screening-clinician') ||
        roleNames.includes('screening-review-clinician'))
    ) {
      return next()
    }

    const isPharmacyFlowRequest = requiredPermissions.every((permission) =>
      this.isPharmacyFlowPermission(permission)
    )

    if (isPharmacyFlowRequest && roleNames.includes('pharmacist')) {
      return next()
    }

    return ctx.response.abort('Forbidden', 403)
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    authRoleNames?: string[]
    authPermissionNames?: string[]
  }
}
