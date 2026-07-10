import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import AccessoryType from './accessory_type.js'
import BedAccessoryMove from './bed_accessory_move.js'
import Bed from './bed.js'

export default class BedAccessory extends BaseModel {
  static table = 'bed_accessories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare accessoryTypeId: number

  @column()
  declare assetTag: string | null

  @column()
  declare name: string | null

  @column()
  declare bedId: number | null

  @column()
  declare status: string

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => AccessoryType, { foreignKey: 'accessoryTypeId' })
  declare accessoryType: BelongsTo<typeof AccessoryType>

  @belongsTo(() => Bed, { foreignKey: 'bedId' })
  declare bed: BelongsTo<typeof Bed>

  @hasMany(() => BedAccessoryMove, { foreignKey: 'bedAccessoryId' })
  declare bedAccessoryMoves: HasMany<typeof BedAccessoryMove>

}
