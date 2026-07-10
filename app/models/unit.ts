import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Unit extends BaseModel {
  static table = 'units'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare form: string | null

  @column()
  declare strength: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

}
