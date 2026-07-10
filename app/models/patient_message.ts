import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Patient from './patient.js'

export default class PatientMessage extends BaseModel {
  static table = 'patient_messages'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare subject: string

  @column()
  declare body: string

  @column()
  declare direction: string

  @column.dateTime()
  declare readAt: DateTime | null

  @column()
  declare staffUserId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

}
