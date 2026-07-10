import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import ScreeningRecord from './screening_record.js'
import User from './user.js'

export default class ScreeningVitalRecheck extends BaseModel {
  static table = 'screening_vital_rechecks'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare screeningRecordId: number

  @column()
  declare encounterId: number

  @column()
  declare weight: number | null

  @column()
  declare height: number | null

  @column()
  declare bpSystolic: number | null

  @column()
  declare bpDiastolic: number | null

  @column()
  declare pulse: number | null

  @column()
  declare temperature: number | null

  @column({ columnName: 'spo2' })
  declare spo2: number | null

  @column()
  declare notes: string | null

  @column()
  declare recordedBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => ScreeningRecord, { foreignKey: 'screeningRecordId' })
  declare screeningRecord: BelongsTo<typeof ScreeningRecord>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => User, { foreignKey: 'recordedBy' })
  declare recordedByUser: BelongsTo<typeof User>

}
