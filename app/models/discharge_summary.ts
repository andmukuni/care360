import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BedAssignment from './bed_assignment.js'
import Encounter from './encounter.js'
import Patient from './patient.js'
import User from './user.js'

export default class DischargeSummary extends BaseModel {
  static table = 'discharge_summaries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare encounterId: number | null

  @column()
  declare bedAssignmentId: number | null

  @column()
  declare title: string | null

  @column()
  declare summary: string

  @column()
  declare visibleToPatient: boolean

  @column()
  declare authoredBy: number | null

  @column.dateTime()
  declare dischargedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => BedAssignment, { foreignKey: 'bedAssignmentId' })
  declare bedAssignment: BelongsTo<typeof BedAssignment>

  @belongsTo(() => User, { foreignKey: 'authoredBy' })
  declare authoredByUser: BelongsTo<typeof User>

}
