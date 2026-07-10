import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import LabRequestItem from './lab_request_item.js'
import LabResult from './lab_result.js'
import LabSample from './lab_sample.js'
import Patient from './patient.js'
import ScreeningRecord from './screening_record.js'
import User from './user.js'

export default class LabRequest extends BaseModel {
  static table = 'lab_requests'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare screeningRecordId: number | null

  @column()
  declare requestedBy: number

  @column()
  declare requestNumber: string

  @column()
  declare requestNotes: string | null

  @column()
  declare priorityLevel: string | null

  @column()
  declare status: string

  @column.dateTime()
  declare requestedAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => ScreeningRecord, { foreignKey: 'screeningRecordId' })
  declare screeningRecord: BelongsTo<typeof ScreeningRecord>

  @belongsTo(() => User, { foreignKey: 'requestedBy' })
  declare requestedByUser: BelongsTo<typeof User>

  @hasMany(() => LabRequestItem, { foreignKey: 'labRequestId' })
  declare labRequestItems: HasMany<typeof LabRequestItem>

  @hasMany(() => LabResult, { foreignKey: 'labRequestId' })
  declare labResults: HasMany<typeof LabResult>

  @hasMany(() => LabSample, { foreignKey: 'labRequestId' })
  declare labSamples: HasMany<typeof LabSample>

}
