import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Appointment from './appointment.js'
import User from './user.js'

export default class CalendarEvent extends BaseModel {
  static table = 'calendar_events'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column.date()
  declare eventDate: DateTime

  @column()
  declare startTime: string | null

  @column()
  declare endTime: string | null

  @column()
  declare eventType: string

  @column()
  declare location: string | null

  @column()
  declare createdBy: number

  @column()
  declare appointmentId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => Appointment, { foreignKey: 'appointmentId' })
  declare appointment: BelongsTo<typeof Appointment>

}
