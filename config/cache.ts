import env from '#start/env'
import { defineConfig, store, drivers } from '@adonisjs/cache'

/**
 * Use CACHE_STORE=redis for shared/multi-instance cache (same Redis host is fine
 * when REDIS_KEY_PREFIX / REDIS_DB isolate Care360). Soft-fail wrappers keep
 * requests alive if Redis is slow or down. Use CACHE_STORE=memory to skip Redis.
 */
const useRedis = env.get('CACHE_STORE') === 'redis'
const defaultStore = useRedis ? 'redis' : 'memory'

const stores = {
  memory: store().useL1Layer(drivers.memory({ maxSize: '100mb' })),
  ...(useRedis
    ? {
        redis: store()
          .useL1Layer(drivers.memory({ maxSize: '100mb' }))
          .useL2Layer(drivers.redis({ connectionName: 'main' as const }))
          .useBus(drivers.redisBus({ connectionName: 'main' as const })),
      }
    : {}),
}

const cacheConfig = defineConfig({
  default: defaultStore,
  ttl: '24h',
  stores,
})

export default cacheConfig
