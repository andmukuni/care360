import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Bed from './bed.js'
import DischargeSummary from './discharge_summary.js'
import Encounter from './encounter.js'
import Patient from './patient.js'
import User from './user.js'

export default class BedAssignment extends BaseModel {
  static table = 'bed_assignments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bedId: number

  @column()
  declare encounterId: number | null

  @column()
  declare patientId: number | null

  @column()
  declare patientName: string | null

  @column.dateTime()
  declare admittedAt: DateTime | null

  @column.dateTime()
  declare dischargedAt: DateTime | null

  @column()
  declare admittedBy: number | null

  @column()
  declare dischargedBy: number | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Bed, { foreignKey: 'bedId' })
  declare bed: BelongsTo<typeof Bed>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'admittedBy' })
  declare admittedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'dischargedBy' })
  declare dischargedByUser: BelongsTo<typeof User>

  @hasMany(() => DischargeSummary, { foreignKey: 'bedAssignmentId' })
  declare dischargeSummaries: HasMany<typeof DischargeSummary>

}
