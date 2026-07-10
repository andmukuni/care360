import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'

/**
 * Liveness/health check. Mirrors Laravel's `GET /up`.
 */
router.get('/up', async ({ response }) => {
  return response.ok({ status: 'ok', ts: new Date().toISOString() })
})

/**
 * Readiness check that also verifies database connectivity.
 */
router.get('/health/db', async ({ response }) => {
  try {
    const result = await db.rawQuery('select 1 as ok')
    return response.ok({ database: 'up', result: result.rows?.[0] ?? result })
  } catch (error) {
    return response.internalServerError({ database: 'down', message: error.message })
  }
})
