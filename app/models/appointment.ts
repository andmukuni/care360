import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import CalendarEvent from './calendar_event.js'
import Encounter from './encounter.js'
import Patient from './patient.js'
import User from './user.js'

export default class Appointment extends BaseModel {
  static table = 'appointments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare requestedByPatientId: number

  @column()
  declare appointmentType: string

  @column()
  declare appointmentPurpose: string | null

  @column()
  declare preferredProviderId: number | null

  @column.date()
  declare preferredDate: DateTime

  @column()
  declare preferredTime: string | null

  @column.date()
  declare alternateDate: DateTime | null

  @column()
  declare alternateTime: string | null

  @column()
  declare reason: string | null

  @column()
  declare status: string

  @column.date()
  declare confirmedDate: DateTime | null

  @column()
  declare confirmedTime: string | null

  @column()
  declare confirmedBy: number | null

  @column()
  declare staffNotes: string | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column()
  declare cancellationReason: string | null

  @column.dateTime()
  declare reminderSentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'confirmedBy' })
  declare confirmedByUser: BelongsTo<typeof User>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'preferredProviderId' })
  declare preferredProvider: BelongsTo<typeof User>

  @belongsTo(() => Patient, { foreignKey: 'requestedByPatientId' })
  declare requestedByPatient: BelongsTo<typeof Patient>

  @hasMany(() => CalendarEvent, { foreignKey: 'appointmentId' })
  declare calendarEvents: HasMany<typeof CalendarEvent>

  @hasMany(() => Encounter, { foreignKey: 'appointmentId' })
  declare encounters: HasMany<typeof Encounter>

}
