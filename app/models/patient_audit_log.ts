import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Patient from './patient.js'

export default class PatientAuditLog extends BaseModel {
  static table = 'patient_audit_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare action: string

  @column()
  declare resourceType: string | null

  @column()
  declare resourceId: number | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column()
  declare metadata: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

}
