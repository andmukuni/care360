import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class CorporateMembershipLead extends BaseModel {
  static table = 'corporate_membership_leads'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare companyName: string

  @column()
  declare contactName: string

  @column()
  declare jobTitle: string | null

  @column()
  declare email: string

  @column()
  declare phone: string | null

  @column()
  declare registrationNumber: string | null

  @column()
  declare employeesCount: number | null

  @column()
  declare partnershipOption: string

  @column()
  declare estimatedDepositOrVolume: number | null

  @column()
  declare message: string | null

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

}
