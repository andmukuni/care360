import logger from '@adonisjs/core/services/logger'

/**
 * Soft-fail helpers around @adonisjs/cache so a dead/slow Redis (or any
 * cache backend error) never takes down a staff request.
 *
 * - getOrSet: on cache-layer error → run the factory (DB) and return
 * - Bentocache factory/DB errors (E_FACTORY_ERROR) are rethrown as-is
 * - mutations (set/delete/invalidate): log and ignore
 */

function isBentocacheFactoryError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === 'E_FACTORY_ERROR'
}

export async function safeCacheGetOrSet<T>(
  label: string,
  run: () => Promise<T>,
  factory: () => Promise<T>
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isBentocacheFactoryError(error)) {
      throw error
    }
    logger.warn({ err: error, cacheOp: label }, 'Cache getOrSet failed; falling back to factory')
    return factory()
  }
}

export async function safeCacheMutation(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (error) {
    logger.warn({ err: error, cacheOp: label }, 'Cache mutation failed; continuing without cache')
  }
}

export async function safeCacheGet<T>(
  label: string,
  run: () => Promise<T | undefined | null>
): Promise<T | undefined | null> {
  try {
    return await run()
  } catch (error) {
    if (isBentocacheFactoryError(error)) {
      throw error
    }
    logger.warn({ err: error, cacheOp: label }, 'Cache get failed; treating as miss')
    return undefined
  }
}
