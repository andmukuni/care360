import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import EmergencyService from './emergency_service.js'
import Patient from './patient.js'

export default class EmergencyContactLog extends BaseModel {
  static table = 'emergency_contact_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare emergencyServiceId: number

  @column()
  declare source: string

  @column()
  declare phoneDialed: string | null

  @column.dateTime()
  declare contactedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => EmergencyService, { foreignKey: 'emergencyServiceId' })
  declare emergencyService: BelongsTo<typeof EmergencyService>

}
