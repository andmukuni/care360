import env from '#start/env'
import app from '@adonisjs/core/services/app'

function urlUsesHttps(url: string | undefined): boolean | undefined {
  if (!url) {
    return undefined
  }

  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return undefined
  }
}

/**
 * Whether session and CSRF cookies use the Secure flag.
 *
 * Priority:
 * 1. COOKIE_SECURE env (explicit true/false)
 * 2. APP_URL or Coolify SERVICE_URL_APP (http → false, https → true)
 * 3. production default (true)
 */
export function cookieSecure(): boolean {
  const explicit = env.get('COOKIE_SECURE')
  if (explicit !== undefined) {
    return explicit
  }

  for (const candidate of [env.get('APP_URL'), env.get('SERVICE_URL_APP')]) {
    const https = urlUsesHttps(candidate)
    if (https !== undefined) {
      return https
    }
  }

  return app.inProduction
}
