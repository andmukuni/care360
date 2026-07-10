import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import LabRequestItem from './lab_request_item.js'
import LabRequest from './lab_request.js'
import Patient from './patient.js'
import User from './user.js'

export default class LabResult extends BaseModel {
  static table = 'lab_results'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare labRequestId: number

  @column()
  declare labRequestItemId: number | null

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare recordedBy: number

  @column()
  declare verifiedBy: number | null

  @column()
  declare resultValue: string | null

  @column()
  declare resultText: string | null

  @column()
  declare referenceRange: string | null

  @column()
  declare interpretation: string | null

  @column()
  declare remarks: string | null

  @column()
  declare resultStatus: string

  @column.dateTime()
  declare resultRecordedAt: DateTime

  @column.dateTime()
  declare verifiedAt: DateTime | null

  @column.dateTime()
  declare releasedToPatientAt: DateTime | null

  @column()
  declare releasedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabRequest, { foreignKey: 'labRequestId' })
  declare labRequest: BelongsTo<typeof LabRequest>

  @belongsTo(() => LabRequestItem, { foreignKey: 'labRequestItemId' })
  declare labRequestItem: BelongsTo<typeof LabRequestItem>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'recordedBy' })
  declare recordedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'verifiedBy' })
  declare verifiedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'releasedBy' })
  declare releasedByUser: BelongsTo<typeof User>

}
