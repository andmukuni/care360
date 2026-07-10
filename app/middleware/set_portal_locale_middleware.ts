import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Resolve the portal request locale. Ported from
 * App\Http\Middleware\SetPortalLocale.
 *
 * Reads the X-Portal-Locale header (falling back to Accept-Language), normalises
 * it to a bare language subtag and validates it against the supported set,
 * defaulting to English. The resolved locale is stashed on the context as
 * `ctx.portalLocale` for downstream use.
 */
const SUPPORTED = ['en', 'zh', 'ja', 'fr', 'pt', 'es'] as const

export default class SetPortalLocaleMiddleware {
  private resolveLocale(ctx: HttpContext): string {
    const header = ctx.request.header('X-Portal-Locale') ?? ctx.request.header('Accept-Language')

    if (typeof header === 'string' && header !== '') {
      let candidate = header.toLowerCase().trim().split(',')[0]
      candidate = candidate.split('-')[0]
      candidate = candidate.split('_')[0]

      if ((SUPPORTED as readonly string[]).includes(candidate)) {
        return candidate
      }
    }

    return 'en'
  }

  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    ctx.portalLocale = this.resolveLocale(ctx)

    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    portalLocale?: string
  }
}
