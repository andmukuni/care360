import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import Patient from './patient.js'
import User from './user.js'

export default class EncounterQueueTransition extends BaseModel {
  static table = 'encounter_queue_transitions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare fromStage: string | null

  @column()
  declare toStage: string

  @column()
  declare queuedBy: number

  @column()
  declare receivedBy: number | null

  @column.dateTime()
  declare queuedAt: DateTime

  @column.dateTime()
  declare receivedAt: DateTime | null

  @column()
  declare transitionNotes: string | null

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'queuedBy' })
  declare queuedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'receivedBy' })
  declare receivedByUser: BelongsTo<typeof User>

}
