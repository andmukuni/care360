import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class PatientDependent extends BaseModel {
  static table = 'patient_dependents'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare guardianPatientId: number

  @column()
  declare dependentPatientId: number

  @column()
  declare relationship: string

  @column()
  declare canViewRecords: boolean

  @column()
  declare canBookAppointments: boolean

  @column.dateTime()
  declare authorizedAt: DateTime | null

  @column()
  declare authorizedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'authorizedBy' })
  declare authorizedByUser: BelongsTo<typeof User>

}
