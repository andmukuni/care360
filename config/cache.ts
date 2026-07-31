import env from '#start/env'
import { defineConfig, store, drivers } from '@adonisjs/cache'

/**
 * Default is in-memory only. Redis L2 is opt-in via CACHE_STORE=redis and
 * requires the redis provider (see adonisrc.ts). Prefer memory on single-instance
 * deploys so a dead Redis never takes the app down.
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
