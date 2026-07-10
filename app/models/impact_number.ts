import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ImpactNumber extends BaseModel {
  static table = 'impact_numbers'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare metric: string

  @column()
  declare value: string | null

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

}
