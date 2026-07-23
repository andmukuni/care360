import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'

/**
 * Reset every staff user's password to a shared default and flag them to
 * choose change-or-keep on next login.
 *
 *   node ace users:reset-default-passwords
 *   node ace users:reset-default-passwords --password=123456
 *   node ace users:reset-default-passwords --dry-run
 */
export default class ResetDefaultPasswords extends BaseCommand {
  static commandName = 'users:reset-default-passwords'
  static description =
    'Set all staff passwords to a default value and require a change-or-keep choice on next login'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Plaintext default password', default: '123456' })
  declare password: string

  @flags.boolean({ description: 'Show how many users would be updated without writing' })
  declare dryRun: boolean

  async run() {
    const plain = this.password || '123456'
    if (plain.length < 6) {
      this.logger.error('Password must be at least 6 characters.')
      this.exitCode = 1
      return
    }

    const [{ count }] = await db.from('users').count('* as count')
    const total = Number(count ?? 0)
    this.logger.info(`Found ${total} staff user(s).`)

    if (this.dryRun) {
      this.logger.info(`[dry-run] Would set password and must_change_password=true for ${total} user(s).`)
      return
    }

    const hashed = await hash.use('laravel_bcrypt').make(plain)
    const updated = await db.from('users').update({
      password: hashed,
      must_change_password: true,
      updated_at: new Date(),
    })

    this.logger.success(
      `Updated ${typeof updated === 'number' ? updated : total} staff password(s) to the default and flagged must_change_password.`
    )
  }
}
