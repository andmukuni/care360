import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BedAccessory from './bed_accessory.js'
import User from './user.js'

export default class BedAccessoryMove extends BaseModel {
  static table = 'bed_accessory_moves'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bedAccessoryId: number

  @column()
  declare fromBedId: number | null

  @column()
  declare toBedId: number | null

  @column()
  declare movedBy: number | null

  @column.dateTime()
  declare movedAt: DateTime

  @column()
  declare reason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => BedAccessory, { foreignKey: 'bedAccessoryId' })
  declare bedAccessory: BelongsTo<typeof BedAccessory>

  @belongsTo(() => User, { foreignKey: 'movedBy' })
  declare movedByUser: BelongsTo<typeof User>

}
