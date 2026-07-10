import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EmergencyContactLog from './emergency_contact_log.js'

export default class EmergencyService extends BaseModel {
  static table = 'emergency_services'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare category: string

  @column()
  declare phoneNumber: string

  @column()
  declare secondaryPhone: string | null

  @column()
  declare description: string | null

  @column()
  declare instructions: string | null

  @column()
  declare is247: boolean

  @column()
  declare isActive: boolean

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => EmergencyContactLog, { foreignKey: 'emergencyServiceId' })
  declare emergencyContactLogs: HasMany<typeof EmergencyContactLog>

}
