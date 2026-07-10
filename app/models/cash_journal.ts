import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import CashJournalLine from './cash_journal_line.js'

export default class CashJournal extends BaseModel {
  static table = 'cash_journals'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => CashJournalLine, { foreignKey: 'cashJournalId' })
  declare cashJournalLines: HasMany<typeof CashJournalLine>

}
