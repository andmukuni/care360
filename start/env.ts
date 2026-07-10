/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  COOKIE_SECURE: Env.schema.boolean.optional(),
  APP_URL: Env.schema.string.optional(),
  SERVICE_URL_APP: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DATABASE_URL: Env.schema.string.optional(),
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Reports, payments, and container boot flags (optional)
  |----------------------------------------------------------
  */
  REPORT_FACILITY_NAME: Env.schema.string.optional(),
  REPORT_PROVINCE: Env.schema.string.optional(),
  REPORT_DISTRICT: Env.schema.string.optional(),
  REPORTS_PROCESS_EXPORTS_SYNC: Env.schema.string.optional(),
  RUN_DICTIONARY_SYNC: Env.schema.string.optional(),
  PAYMENTS_GATEWAY: Env.schema.string.optional(),
  PAYMENTS_CURRENCY: Env.schema.string.optional(),
  PAYMENTS_COUNTRY: Env.schema.string.optional(),
  PAYMENTS_FEE_BEARER: Env.schema.string.optional(),
  PAYMENTS_POLL_TIMEOUT: Env.schema.number.optional(),
  LENCO_BASE_URL: Env.schema.string.optional(),
  LENCO_API_TOKEN: Env.schema.string.optional(),
  LENCO_WEBHOOK_SECRET: Env.schema.string.optional(),
  LENCO_OTP_PATH: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Redis and cache
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string.optional(),
  REDIS_PORT: Env.schema.number.optional(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  REDIS_DB: Env.schema.number.optional(),
  CACHE_STORE: Env.schema.enum(['redis', 'memory'] as const),
  CACHE_REF_DATA_TTL: Env.schema.string.optional(),
  CACHE_PATIENTS_FULL_LIST: Env.schema.boolean.optional(),
})
