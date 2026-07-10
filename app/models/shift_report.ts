import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ShiftReportStaffAssignment from './shift_report_staff_assignment.js'
import User from './user.js'

export default class ShiftReport extends BaseModel {
  static table = 'shift_reports'

  @column({ isPrimary: true })
  declare id: number

  @column.date()
  declare reportDate: DateTime | null

  @column()
  declare shiftType: string | null

  @column()
  declare totalPatientsSeen: number | null

  @column()
  declare reportedBy: string | null

  @column.dateTime()
  declare sourceCreatedAt: DateTime | null

  @column()
  declare sourceRowKey: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'reportedBy' })
  declare reportedByUser: BelongsTo<typeof User>

  @hasMany(() => ShiftReportStaffAssignment, { foreignKey: 'shiftReportId' })
  declare shiftReportStaffAssignments: HasMany<typeof ShiftReportStaffAssignment>

}
