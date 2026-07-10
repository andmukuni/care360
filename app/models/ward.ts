import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Bed from './bed.js'
import Encounter from './encounter.js'

export default class Ward extends BaseModel {
  static table = 'wards'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare type: string

  @column()
  declare wing: string

  @column()
  declare location: string | null

  @column()
  declare notes: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Bed, { foreignKey: 'wardId' })
  declare beds: HasMany<typeof Bed>

  @hasMany(() => Encounter, { foreignKey: 'wardId' })
  declare encounters: HasMany<typeof Encounter>

}
