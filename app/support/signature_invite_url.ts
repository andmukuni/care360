import type { Request } from '@adonisjs/core/http'
import env from '#start/env'

/**
 * Absolute URL for a mobile signature invite (shareable link).
 */
export function signatureInviteUrl(request: Request, token: string): string {
  const configured = env.get('APP_URL')?.replace(/\/$/, '')
  const origin = configured ?? `${request.protocol()}://${request.host()}`
  return `${origin}/sign/${token}`
}
