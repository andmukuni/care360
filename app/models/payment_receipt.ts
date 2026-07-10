import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Payment from './payment.js'

export default class PaymentReceipt extends BaseModel {
  static table = 'payment_receipts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare paymentId: number

  @column()
  declare receiptNumber: string

  @column()
  declare filePath: string | null

  @column.dateTime()
  declare generatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Payment, { foreignKey: 'paymentId' })
  declare payment: BelongsTo<typeof Payment>

}
