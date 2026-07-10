import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Invoice from './invoice.js'
import Patient from './patient.js'
import PaymentReceipt from './payment_receipt.js'
import User from './user.js'

export default class Payment extends BaseModel {
  static table = 'payments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare invoiceId: number

  @column()
  declare patientId: number

  @column()
  declare amount: number

  @column()
  declare paymentMethod: string | null

  @column()
  declare provider: string | null

  @column()
  declare providerReference: string | null

  @column.dateTime()
  declare paidAt: DateTime

  @column()
  declare recordedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Invoice, { foreignKey: 'invoiceId' })
  declare invoice: BelongsTo<typeof Invoice>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'recordedBy' })
  declare recordedByUser: BelongsTo<typeof User>

  @hasMany(() => PaymentReceipt, { foreignKey: 'paymentId' })
  declare paymentReceipts: HasMany<typeof PaymentReceipt>

}
