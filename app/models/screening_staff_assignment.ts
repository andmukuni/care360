import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ScreeningRecord from './screening_record.js'
import User from './user.js'

export default class ScreeningStaffAssignment extends BaseModel {
  static table = 'screening_staff_assignments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare screeningRecordId: number

  @column()
  declare userId: number

  @column()
  declare roleName: string | null

  @column()
  declare participationType: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => ScreeningRecord, { foreignKey: 'screeningRecordId' })
  declare screeningRecord: BelongsTo<typeof ScreeningRecord>

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

}
