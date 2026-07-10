import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import WellnessFundAccount from './wellness_fund_account.js'

export default class MembershipPlan extends BaseModel {
  static table = 'membership_plans'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare membershipType: string

  @column()
  declare tier: number

  @column()
  declare description: string | null

  @column()
  declare minimumDeposit: number

  @column()
  declare minBalance: number | null

  @column()
  declare discountPercent: number

  @column()
  declare perks: string | null

  @column()
  declare isActive: boolean

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => WellnessFundAccount, { foreignKey: 'membershipPlanId' })
  declare wellnessFundAccounts: HasMany<typeof WellnessFundAccount>

}
