import type { HttpContext } from '@adonisjs/core/http'
import pwa from '#config/pwa'
import ClinicSettings from '#support/clinic_settings'

/**
 * Serves the dynamic web app manifest.
 *
 * Ported from App\Http\Controllers\PwaController. The manifest is generated at
 * request time from `config/pwa.ts` and returned with the
 * `application/manifest+json` content type so browsers treat it as a PWA
 * manifest.
 */
export default class PwaController {
  /**
   * Offline fallback page for the service worker. Branding comes from
   * Settings → Clinic (`system_settings`) via ClinicSettings.
   */
  async offline({ view }: HttpContext) {
    const branding = await ClinicSettings.branding()

    return view.render('pages/offline', {
      facilityName: branding.name,
      logoUrl: branding.logoUrl,
      hideLogo: branding.hideLogo,
    })
  }

  async manifest({ response }: HttpContext) {
    const manifest = {
      name: pwa.name,
      short_name: pwa.shortName,
      description: pwa.description,
      start_url: pwa.startUrl,
      scope: pwa.scope,
      display: 'standalone',
      orientation: 'any',
      background_color: pwa.backgroundColor,
      theme_color: pwa.themeColor,
      icons: [
        {
          src: '/pwa/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    }

    return response
      .header('Content-Type', 'application/manifest+json')
      .status(200)
      .send(JSON.stringify(manifest))
  }
}
