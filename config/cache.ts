import env from '#start/env'
import { defineConfig, store, drivers } from '@adonisjs/cache'

const useRedis = env.get('CACHE_STORE') === 'redis'

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
  default: env.get('CACHE_STORE'),
  ttl: '24h',
  stores,
})

export default cacheConfig
