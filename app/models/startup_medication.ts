import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import Medication from './medication.js'
import Patient from './patient.js'
import TriageRecord from './triage_record.js'
import User from './user.js'

export default class StartupMedication extends BaseModel {
  static table = 'startup_medications'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare triageRecordId: number | null

  @column()
  declare patientId: number

  @column()
  declare recordedBy: number | null

  @column()
  declare medicationId: number | null

  @column()
  declare medicationName: string

  @column()
  declare dosage: string | null

  @column()
  declare route: string | null

  @column()
  declare frequency: string | null

  @column()
  declare notes: string | null

  @column.dateTime()
  declare administeredAt: DateTime | null

  @column()
  declare source: string

  @column()
  declare status: string

  @column.dateTime()
  declare discontinuedAt: DateTime | null

  @column()
  declare discontinuedBy: number | null

  @column()
  declare discontinuedReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => TriageRecord, { foreignKey: 'triageRecordId' })
  declare triageRecord: BelongsTo<typeof TriageRecord>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'recordedBy' })
  declare recordedByUser: BelongsTo<typeof User>

  @belongsTo(() => Medication, { foreignKey: 'medicationId' })
  declare medication: BelongsTo<typeof Medication>

  @belongsTo(() => User, { foreignKey: 'discontinuedBy' })
  declare discontinuedByUser: BelongsTo<typeof User>

}
