import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * users:compress-profile-photos
 *
 * Ported from the Laravel Artisan command of the same name. The original used
 * App\Services\Images\ProfilePhotoOptimizer (GD/Imagick) to re-encode uploaded
 * photos. No image-processing library is installed in this AdonisJS app, so
 * this command currently reports what WOULD be processed and stops.
 *
 * FOLLOW-UP: install `sharp` (or similar) and implement the optimize step; see
 * coordinator notes. Until then this is a safe, read-only reporting stub.
 */
export default class CompressProfilePhotos extends BaseCommand {
  static commandName = 'users:compress-profile-photos'
  static description = 'Compress existing uploaded user profile photos for faster loading.'
  static options: CommandOptions = { startApp: true }

  @flags.number({ flagName: 'max-edge', description: 'Max edge length in px' })
  declare maxEdge: number

  @flags.number({ description: 'JPEG/WebP quality (40-95)' })
  declare quality: number

  @flags.boolean({ flagName: 'dry-run', description: 'Report only, make no changes' })
  declare dryRun: boolean

  async run(): Promise<void> {
    const maxEdge = Math.max(120, Number(this.maxEdge ?? 640))
    const quality = Math.max(40, Math.min(95, Number(this.quality ?? 78)))

    const result = await db
      .from('users')
      .whereNotNull('profile_photo_path')
      .where('profile_photo_path', '!=', '')
      .count('* as total')
    const total = Number((result[0] as any).total)

    if (total === 0) {
      this.logger.info('No user profile photos found.')
      return
    }

    this.logger.info(`Found ${total} profile photo(s) eligible for compression.`)
    this.logger.warning(
      'Image optimization is NOT implemented: this AdonisJS app has no image library.'
    )
    this.logger.info(
      `Requested settings — max-edge=${maxEdge} quality=${quality} dry-run=${Boolean(this.dryRun)}`
    )
    this.logger.info(
      'FOLLOW-UP: install `sharp` and port App\\Services\\Images\\ProfilePhotoOptimizer to enable compression.'
    )
  }
}
