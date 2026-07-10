import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Invoice from './invoice.js'
import Patient from './patient.js'

export default class PaymentCollection extends BaseModel {
  static table = 'payment_collections'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare invoiceId: number | null

  @column()
  declare provider: string

  @column()
  declare reference: string

  @column()
  declare gatewayReference: string | null

  @column()
  declare operator: string | null

  @column()
  declare phone: string | null

  @column()
  declare amount: number

  @column()
  declare currency: string

  @column()
  declare status: string

  @column()
  declare failureReason: string | null

  @column()
  declare meta: string | null

  @column.dateTime()
  declare lastCheckedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Invoice, { foreignKey: 'invoiceId' })
  declare invoice: BelongsTo<typeof Invoice>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

}
