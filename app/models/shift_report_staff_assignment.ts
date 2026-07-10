import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ShiftReport from './shift_report.js'
import User from './user.js'

export default class ShiftReportStaffAssignment extends BaseModel {
  static table = 'shift_report_staff_assignments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare shiftReportId: number

  @column()
  declare userId: number

  @column()
  declare sourceName: string | null

  @column()
  declare sequence: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => ShiftReport, { foreignKey: 'shiftReportId' })
  declare shiftReport: BelongsTo<typeof ShiftReport>

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

}
