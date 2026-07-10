import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import { ensurePublicStorageDirs } from '#support/public_storage_url'

/**
 * users:sync-profile-photos
 *
 * Copy staff profile photos from a legacy Laravel checkout (e.g. BARCODES
 * `storage/app/public/profile-photos`) into this app's `public/storage`.
 *
 * Modes:
 *  - Default: copy files that match each user's existing `profile_photo_path`.
 *  - --bulk: copy every file from the source profile-photos folder.
 *  - --fallback-staff: when the DB path is missing on disk, use staff-{id}.jpg
 *    from the source and update the user row.
 */
export default class SyncProfilePhotos extends BaseCommand {
  static commandName = 'users:sync-profile-photos'
  static description =
    'Import staff profile photos from a legacy source directory into public/storage.'
  static options: CommandOptions = { startApp: true }

  @args.string({
    description: 'Source directory (folder containing profile-photos/ or the photos themselves)',
  })
  declare source: string

  @flags.boolean({
    flagName: 'bulk',
    description: 'Copy every file from source/profile-photos without checking the database',
  })
  declare bulk: boolean

  @flags.boolean({
    flagName: 'fallback-staff',
    description:
      'When a user photo path is missing, assign staff-{id}.jpg from source if present',
  })
  declare fallbackStaff: boolean

  @flags.boolean({ flagName: 'dry-run', description: 'Report actions without copying files' })
  declare dryRun: boolean

  async run(): Promise<void> {
    const sourceRoot = this.resolveSourceRoot(this.source)
    const photoDir = this.resolvePhotoDir(sourceRoot)

    if (!existsSync(photoDir)) {
      this.logger.error(`Source profile-photos directory not found: ${photoDir}`)
      this.exitCode = 1
      return
    }

    ensurePublicStorageDirs()

    if (this.bulk) {
      await this.runBulkCopy(photoDir)
      return
    }

    await this.runDbSync(photoDir)
  }

  private resolveSourceRoot(path: string): string {
    if (path.startsWith('~/')) {
      const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
      return join(home, path.slice(2))
    }

    return path
  }

  private resolvePhotoDir(sourceRoot: string): string {
    const nested = join(sourceRoot, 'profile-photos')
    if (existsSync(nested)) {
      return nested
    }

    return sourceRoot
  }

  private async runBulkCopy(photoDir: string): Promise<void> {
    const files = readdirSync(photoDir).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
    let copied = 0

    for (const file of files) {
      const destRelative = `profile-photos/${file}`
      if (this.copyFile(photoDir, file, destRelative)) {
        copied++
      }
    }

    this.logger.info(
      `${this.dryRun ? 'Would copy' : 'Copied'} ${copied} file(s) from ${photoDir} (bulk mode).`
    )
  }

  private async runDbSync(photoDir: string): Promise<void> {
    const users = await User.query()
      .whereNotNull('profile_photo_path')
      .where('profile_photo_path', '!=', '')
      .orderBy('id')

    let copied = 0
    let alreadyPresent = 0
    let missing = 0
    let fallbackAssigned = 0

    for (const user of users) {
      const relativePath = user.profilePhotoPath!.trim()
      const destAbsolute = app.makePath('public/storage', relativePath)

      if (existsSync(destAbsolute)) {
        alreadyPresent++
        continue
      }

      const sourceFile = join(photoDir, basename(relativePath))
      if (existsSync(sourceFile)) {
        if (this.copyFile(photoDir, basename(relativePath), relativePath)) {
          copied++
        }
        continue
      }

      if (this.fallbackStaff) {
        const fallbackName = `staff-${user.id}.jpg`
        const fallbackSource = join(photoDir, fallbackName)
        const fallbackRelative = `profile-photos/${fallbackName}`

        if (existsSync(fallbackSource)) {
          if (!this.dryRun) {
            this.copyFile(photoDir, fallbackName, fallbackRelative)
            user.profilePhotoPath = fallbackRelative
            await user.save()
          }
          fallbackAssigned++
          copied++
          continue
        }
      }

      missing++
      this.logger.warning(`Missing source for user #${user.id} (${user.email}): ${relativePath}`)
    }

    this.logger.info(
      [
        `Sync complete.`,
        `${copied} copied`,
        `${alreadyPresent} already on disk`,
        `${fallbackAssigned} fallback staff-{id}.jpg`,
        `${missing} still missing`,
        this.dryRun ? '(dry-run)' : '',
      ]
        .filter(Boolean)
        .join(' — ')
    )
  }

  private copyFile(sourceDir: string, fileName: string, destRelative: string): boolean {
    const sourceAbsolute = join(sourceDir, fileName)
    const destAbsolute = app.makePath('public/storage', destRelative)

    if (!existsSync(sourceAbsolute)) {
      return false
    }

    if (this.dryRun) {
      this.logger.info(`Would copy ${sourceAbsolute} → ${destRelative}`)
      return true
    }

    mkdirSync(dirname(destAbsolute), { recursive: true })
    copyFileSync(sourceAbsolute, destAbsolute)
    return true
  }
}
