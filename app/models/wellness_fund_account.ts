import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import MembershipPlan from './membership_plan.js'
import Patient from './patient.js'
import User from './user.js'
import WellnessFundLedgerEntry from './wellness_fund_ledger_entry.js'

export default class WellnessFundAccount extends BaseModel {
  static table = 'wellness_fund_accounts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare membershipPlanId: number

  @column()
  declare balance: number

  @column()
  declare totalDeposited: number

  @column()
  declare status: string

  @column.dateTime()
  declare enrolledAt: DateTime | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column.dateTime()
  declare cancelRequestedAt: DateTime | null

  @column.dateTime()
  declare suspendedAt: DateTime | null

  @column()
  declare suspensionReason: string | null

  @column()
  declare paymentProvider: string | null

  @column()
  declare enrolledBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => MembershipPlan, { foreignKey: 'membershipPlanId' })
  declare membershipPlan: BelongsTo<typeof MembershipPlan>

  @belongsTo(() => User, { foreignKey: 'enrolledBy' })
  declare enrolledByUser: BelongsTo<typeof User>

  @hasMany(() => WellnessFundLedgerEntry, { foreignKey: 'wellnessFundAccountId' })
  declare wellnessFundLedgerEntries: HasMany<typeof WellnessFundLedgerEntry>

}
