import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import Patient from './patient.js'
import User from './user.js'

export default class EncounterAudit extends BaseModel {
  static table = 'encounter_audits'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare actionName: string

  @column()
  declare actionStage: string

  @column()
  declare actionBy: number

  @column()
  declare oldValues: string | null

  @column()
  declare newValues: string | null

  @column()
  declare notes: string | null

  @column.dateTime()
  declare actionAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'actionBy' })
  declare actionByUser: BelongsTo<typeof User>

}
