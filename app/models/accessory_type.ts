import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import BedAccessory from './bed_accessory.js'

export default class AccessoryType extends BaseModel {
  static table = 'accessory_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare iconKey: string | null

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => BedAccessory, { foreignKey: 'accessoryTypeId' })
  declare bedAccessories: HasMany<typeof BedAccessory>

}
