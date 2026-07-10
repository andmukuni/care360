import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CashJournal from './cash_journal.js'
import Encounter from './encounter.js'
import Household from './household.js'
import User from './user.js'

export default class CashJournalLine extends BaseModel {
  static table = 'cash_journal_lines'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare cashJournalId: number

  @column.dateTime()
  declare entryOccurredAt: DateTime

  @column()
  declare amount: number

  @column()
  declare paymentMethod: string | null

  @column()
  declare subscriptionPlan: string | null

  @column()
  declare narrative: string

  @column()
  declare encounterId: number | null

  @column()
  declare householdId: string | null

  @column()
  declare recordedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => CashJournal, { foreignKey: 'cashJournalId' })
  declare cashJournal: BelongsTo<typeof CashJournal>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Household, { foreignKey: 'householdId' })
  declare household: BelongsTo<typeof Household>

  @belongsTo(() => User, { foreignKey: 'recordedBy' })
  declare recordedByUser: BelongsTo<typeof User>

}
