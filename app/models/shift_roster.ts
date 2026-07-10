import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class ShiftRoster extends BaseModel {
  static table = 'shift_rosters'

  @column({ isPrimary: true })
  declare id: number

  @column.date()
  declare shiftDate: DateTime

  @column()
  declare shiftType: string

  @column()
  declare userId: number

  @column()
  declare startTime: string | null

  @column()
  declare endTime: string | null

  @column()
  declare notes: string | null

  @column()
  declare assignedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'assignedBy' })
  declare assignedByUser: BelongsTo<typeof User>

}
