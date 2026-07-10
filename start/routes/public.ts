/*
|--------------------------------------------------------------------------
| Public routes (Phase 8)
|--------------------------------------------------------------------------
|
| Unauthenticated routes: the dynamic PWA manifest and the public corporate
| wellness-fund marketing/signup flow (ported from CorporateMembershipController).
| These sit OUTSIDE any auth group, mirroring the Laravel routes/web.php entries
| registered near the top of the file. Owned by the Phase 8 worker.
|
| Session + shield (CSRF) middleware are applied globally via start/kernel.ts, so
| the POST /wellness-fund/corporate form is CSRF-protected automatically (Inertia
| forwards the XSRF-TOKEN cookie as the X-XSRF-TOKEN header).
|
*/

import router from '@adonisjs/core/services/router'

const PwaController = () => import('#controllers/pwa_controller')
const CorporateMembershipController = () => import('#controllers/corporate_membership_controller')

// Dynamic web app manifest (application/manifest+json).
router.get('/manifest.webmanifest', [PwaController, 'manifest'])

// Offline fallback (branding from Settings → Clinic).
router.get('/offline.html', [PwaController, 'offline'])

// Public corporate wellness-fund marketing + lead capture.
router
  .group(() => {
    // Landing page for /wellness-fund resolves to the corporate partnership page
    // (the Laravel app only exposed /wellness-fund/corporate; this adds a bare
    // index so the section root is reachable).
    router.get('/', [CorporateMembershipController, 'show'])
    router.get('/corporate', [CorporateMembershipController, 'show'])
    router.post('/corporate', [CorporateMembershipController, 'store'])
    router.get('/corporate/thank-you', [CorporateMembershipController, 'thankYou'])
  })
  .prefix('/wellness-fund')
