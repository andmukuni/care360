import type { HttpContext } from '@adonisjs/core/http'
import PublicStatsService from '#services/public/public_stats_service'

/**
 * Public, CORS-enabled clinic stats for the marketing/website embed.
 * Returns aggregates only — no patient identifiers.
 */
export default class PublicStatsController {
  private readonly stats = new PublicStatsService()

  async index({ response }: HttpContext) {
    const payload = await this.stats.snapshot()

    return response
      .header('Cache-Control', 'public, max-age=30')
      .ok(payload)
  }
}
