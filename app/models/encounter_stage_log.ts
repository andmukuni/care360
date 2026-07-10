import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import Patient from './patient.js'
import User from './user.js'

export default class EncounterStageLog extends BaseModel {
  static table = 'encounter_stage_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare stageName: string

  @column()
  declare stageSequence: number

  @column()
  declare status: string

  @column()
  declare startedBy: number | null

  @column()
  declare completedBy: number | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column()
  declare notes: string | null

  @column()
  declare metadata: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'startedBy' })
  declare startedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'completedBy' })
  declare completedByUser: BelongsTo<typeof User>

}
