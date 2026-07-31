import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

/**
 * Shared-Redis-safe connection settings.
 *
 * Care360 can share one Redis host with other apps when:
 * - REDIS_KEY_PREFIX isolates keys (default `care360:`)
 * - REDIS_DB optionally isolates logical DB
 * - fail-fast timeouts + enableOfflineQueue:false so a dead Redis
 *   errors quickly and soft-fail cache wrappers fall back to DB
 */
const password = env.get('REDIS_PASSWORD')
const keyPrefix = env.get('REDIS_KEY_PREFIX', 'care360:')
const connectTimeout = env.get('REDIS_CONNECT_TIMEOUT_MS', 2000)
const commandTimeout = env.get('REDIS_COMMAND_TIMEOUT_MS', 2000)
const maxRetriesPerRequest = env.get('REDIS_MAX_RETRIES_PER_REQUEST', 1)

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      host: env.get('REDIS_HOST', '127.0.0.1'),
      port: env.get('REDIS_PORT', 6379),
      ...(password ? { password } : {}),
      db: env.get('REDIS_DB', 0),
      keyPrefix: keyPrefix.endsWith(':') ? keyPrefix : `${keyPrefix}:`,
      lazyConnect: true,
      connectTimeout,
      commandTimeout,
      maxRetriesPerRequest,
      // Do not buffer commands while disconnected — fail fast for soft-fail fallbacks.
      enableOfflineQueue: false,
      keepAlive: 10000,
      retryStrategy(times) {
        if (times > 8) {
          return null
        }
        return Math.min(times * 200, 2000)
      },
    },
  },
})

export default redisConfig
