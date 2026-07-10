import { SessionLucidUserProvider } from '@adonisjs/auth/session'
import type { LucidAuthenticatable } from '@adonisjs/auth/types'
import type { SessionLucidUserProviderOptions } from '@adonisjs/auth/session'

interface CachedUser<Model extends LucidAuthenticatable> {
  user: InstanceType<Model>
  expiresAt: number
}

const USER_CACHE_TTL_MS = 60_000

/**
 * Short-lived in-memory cache for session auth user lookups. Every
 * authenticated page hit otherwise re-queries the remote database via
 * SessionLucidUserProvider.findById, which is expensive when the DB link is
 * slow or flaky.
 */
export class CachedSessionUserProvider<
  Model extends LucidAuthenticatable,
> extends SessionLucidUserProvider<Model> {
  private static cache = new Map<string, CachedUser<LucidAuthenticatable>>()

  static forgetUser(id: string | number | bigint): void {
    this.cache.delete(String(id))
  }

  async findById(identifier: string | number | bigint) {
    const key = String(identifier)
    const hit = CachedSessionUserProvider.cache.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      return this.createUserForGuard(hit.user as InstanceType<Model>)
    }

    const providerUser = await super.findById(identifier)
    if (providerUser) {
      CachedSessionUserProvider.cache.set(key, {
        user: providerUser.getOriginal(),
        expiresAt: Date.now() + USER_CACHE_TTL_MS,
      })
    }

    return providerUser
  }
}

export function cachedSessionUserProvider<Model extends LucidAuthenticatable>(
  config: SessionLucidUserProviderOptions<Model>
) {
  return new CachedSessionUserProvider(config)
}
