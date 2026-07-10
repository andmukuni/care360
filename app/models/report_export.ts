import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class ReportExport extends BaseModel {
  static table = 'report_exports'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare reportType: string

  @column()
  declare reportName: string

  @column()
  declare status: string

  @column()
  declare filters: string | null

  @column()
  declare totalRows: number

  @column()
  declare processedRows: number

  @column()
  declare filePath: string | null

  @column()
  declare fileSize: number | null

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

}
