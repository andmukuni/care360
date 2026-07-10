import env from '#start/env'
import app from '@adonisjs/core/services/app'

/**
 * Whether session and CSRF cookies use the Secure flag.
 *
 * In production the default is true (HTTPS). Set COOKIE_SECURE=false when the
 * app is served over plain HTTP (e.g. Coolify sslip.io before TLS is enabled).
 */
export function cookieSecure(): boolean {
  const explicit = env.get('COOKIE_SECURE')
  if (explicit !== undefined) {
    return explicit
  }

  return app.inProduction
}
