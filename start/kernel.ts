/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to an HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('@adonisjs/vite/vite_middleware'),
  () => import('@adonisjs/inertia/inertia_middleware')
])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/initialize_bouncer_middleware')
])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  guest: () => import('#middleware/guest_middleware'),
  auth: () => import('#middleware/auth_middleware'),

  /**
   * RBAC + portal middleware ported from the Laravel app (bootstrap/app.php
   * aliases). Dotted Laravel names are mapped to camelCase here since the keys
   * are referenced as object properties.
   *
   *   permission_or_legacy -> permissionOrLegacy
   *   portal.active        -> portalActive
   *   portal.api.active    -> portalApiActive
   *   portal.api.auth      -> portalApiAuth
   *   portal.locale        -> portalLocale
   *   staff.api            -> staffApi
   */
  resolveStaffRbac: () => import('#middleware/resolve_staff_rbac_middleware'),
  permissionOrLegacy: () => import('#middleware/permission_or_legacy_middleware'),
  portalActive: () => import('#middleware/ensure_patient_portal_active_middleware'),
  portalApiActive: () => import('#middleware/ensure_patient_api_portal_active_middleware'),
  portalApiAuth: () => import('#middleware/ensure_patient_api_authenticated_middleware'),
  portalLocale: () => import('#middleware/set_portal_locale_middleware'),
  staffApi: () => import('#middleware/ensure_staff_api_access_middleware'),
})
