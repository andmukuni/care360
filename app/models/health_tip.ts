import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class HealthTip extends BaseModel {
  static table = 'health_tips'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare category: string

  @column()
  declare title: string

  @column()
  declare message: string

  @column()
  declare isActive: boolean

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

}
