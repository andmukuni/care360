/*
|--------------------------------------------------------------------------
| Auth routes (staff + patient portal)
|--------------------------------------------------------------------------
|
| Ported from routes/web.php (staff auth) and the portal auth routes. This
| module is imported by the root start/routes.ts (wired by the coordinator).
|
| Staff auth uses the `web` session guard; patient portal auth uses the
| `patient` session guard.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const PatientAuthController = () => import('#controllers/portal/patient_auth_controller')

/**
 * Staff authentication.
 */
router
  .group(() => {
    router.get('/login', [AuthController, 'showLogin']).as('login').use(middleware.guest())
    router.post('/login', [AuthController, 'login']).as('login.attempt').use(middleware.guest())

    router.post('/logout', [AuthController, 'logout']).as('logout').use(middleware.auth())

    router.get('/dashboard', [AuthController, 'dashboard']).as('dashboard').use([
      middleware.auth(),
      middleware.resolveStaffRbac(),
    ])

    // Lightweight session watchdog ping / keepalive (session-timeout modal).
    router
      .get('/session/ping', [AuthController, 'sessionPing'])
      .as('session.ping')
      .use(middleware.auth())
    router
      .post('/session/keepalive', [AuthController, 'sessionPing'])
      .as('session.keepalive')
      .use(middleware.auth())
  })
  .as('staff')

/**
 * Patient portal authentication (/portal).
 */
router
  .group(() => {
    router
      .get('/login', [PatientAuthController, 'showLogin'])
      .as('login')
      .use(middleware.guest({ guards: ['patient'] }))
    router
      .post('/login', [PatientAuthController, 'login'])
      .as('login.attempt')
      .use(middleware.guest({ guards: ['patient'] }))

    router
      .post('/logout', [PatientAuthController, 'logout'])
      .as('logout')
      .use(middleware.auth({ guards: ['patient'] }))

    router
      .get('/forgot-password', [PatientAuthController, 'showForgotPassword'])
      .as('password.request')
      .use(middleware.guest({ guards: ['patient'] }))
    router
      .post('/forgot-password', [PatientAuthController, 'sendResetLink'])
      .as('password.email')
      .use(middleware.guest({ guards: ['patient'] }))

    router
      .get('/reset-password/:token', [PatientAuthController, 'showResetPassword'])
      .as('password.reset')
      .use(middleware.guest({ guards: ['patient'] }))
    router
      .post('/reset-password', [PatientAuthController, 'resetPassword'])
      .as('password.update')
      .use(middleware.guest({ guards: ['patient'] }))
  })
  .prefix('/portal')
  .as('portal')
