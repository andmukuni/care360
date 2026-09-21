import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Allows the public clinic website to call read-only stats endpoints
 * from a different origin.
 */
export default class PublicApiCorsMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    response.header('Access-Control-Allow-Origin', '*')
    response.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.header('Access-Control-Allow-Headers', 'Accept, Content-Type')
    response.header('Access-Control-Max-Age', '86400')

    return next()
  }
}
