import env from '#start/env'

export type PgConnectionConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

/**
 * Resolve Postgres connection from DATABASE_URL or discrete DB_* variables.
 */
export function resolvePgConnection(): PgConnectionConfig {
  const databaseUrl = env.get('DATABASE_URL')
  if (databaseUrl) {
    const url = new URL(databaseUrl)
    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    }
  }

  return {
    host: env.get('DB_HOST'),
    port: env.get('DB_PORT'),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD') ?? '',
    database: env.get('DB_DATABASE'),
  }
}
