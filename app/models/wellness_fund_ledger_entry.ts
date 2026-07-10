import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Patient from './patient.js'
import User from './user.js'
import WellnessFundAccount from './wellness_fund_account.js'

export default class WellnessFundLedgerEntry extends BaseModel {
  static table = 'wellness_fund_ledger_entries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare wellnessFundAccountId: number | null

  @column()
  declare type: string

  @column()
  declare amount: number

  @column()
  declare balanceAfter: number

  @column()
  declare referenceType: string | null

  @column()
  declare referenceId: number | null

  @column()
  declare description: string | null

  @column()
  declare createdBy: number | null

  @column()
  declare metadata: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => WellnessFundAccount, { foreignKey: 'wellnessFundAccountId' })
  declare wellnessFundAccount: BelongsTo<typeof WellnessFundAccount>

}
