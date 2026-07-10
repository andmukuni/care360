import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import LabRequest from './lab_request.js'
import LabSpecimenType from './lab_specimen_type.js'
import Patient from './patient.js'
import User from './user.js'

export default class LabSample extends BaseModel {
  static table = 'lab_samples'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare labRequestId: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare collectedBy: number

  @column()
  declare sampleType: string

  @column()
  declare labSpecimenTypeId: number | null

  @column()
  declare sampleLabel: string | null

  @column()
  declare collectionNotes: string | null

  @column.dateTime()
  declare collectedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabRequest, { foreignKey: 'labRequestId' })
  declare labRequest: BelongsTo<typeof LabRequest>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'collectedBy' })
  declare collectedByUser: BelongsTo<typeof User>

  @belongsTo(() => LabSpecimenType, { foreignKey: 'labSpecimenTypeId' })
  declare labSpecimenType: BelongsTo<typeof LabSpecimenType>

}
