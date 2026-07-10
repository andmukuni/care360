import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import CashJournalLine from './cash_journal_line.js'
import Patient from './patient.js'

export default class Household extends BaseModel {
  static table = 'households'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare householdId: string

  @column()
  declare headOfHouse: string | null

  @column()
  declare nrcNumber: string | null

  @column()
  declare phoneNumber: string | null

  @column()
  declare village: string | null

  @column()
  declare town: string | null

  @column()
  declare householdType: string | null

  @column()
  declare barcode: string | null

  @column()
  declare subscriptionPlan: string | null

  @column()
  declare subscriptionFee: number | null

  @column()
  declare paymentMethod: string | null

  @column()
  declare paymentStatus: string | null

  @column()
  declare transactionCode: string | null

  @column.dateTime()
  declare sourceCreatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Household, { foreignKey: 'householdId' })
  declare household: BelongsTo<typeof Household>

  @hasMany(() => CashJournalLine, { foreignKey: 'householdId' })
  declare cashJournalLines: HasMany<typeof CashJournalLine>

  @hasMany(() => Patient, { foreignKey: 'householdId' })
  declare patients: HasMany<typeof Patient>

}
