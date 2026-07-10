import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Patient from './patient.js'
import User from './user.js'

export default class PatientRequest extends BaseModel {
  static table = 'patient_requests'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare requestType: string

  @column()
  declare details: string | null

  @column()
  declare status: string

  @column()
  declare staffResponse: string | null

  @column()
  declare fulfilledBy: number | null

  @column.dateTime()
  declare fulfilledAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'fulfilledBy' })
  declare fulfilledByUser: BelongsTo<typeof User>

}
