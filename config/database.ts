import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
import { resolvePgConnection } from '#support/database_url'

const isDev = env.get('NODE_ENV') === 'development'
const pg = resolvePgConnection()

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: pg.host,
        port: pg.port,
        user: pg.user,
        password: pg.password,
        database: pg.database,
        // Keep remote sockets alive; idle NAT/firewall drops cause "Connection terminated unexpectedly"
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000,
        // Fail fast when the remote host is unreachable instead of wedging the pool
        connectionTimeoutMillis: 5_000,
      },
      pool: {
        min: 0,
        // Production needs enough headroom for concurrent clinical screens;
        // a saturated pool surfaces as KnexTimeoutError across the whole app.
        max: isDev ? 5 : 40,
        idleTimeoutMillis: 15_000,
        acquireTimeoutMillis: isDev ? 8_000 : 20_000,
        createTimeoutMillis: 10_000,
        propagateCreateError: true,
        reapIntervalMillis: 3_000,
        createRetryIntervalMillis: 500,
        afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
          conn.query('SELECT 1', (err: Error | null) => done(err, conn))
        },
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig