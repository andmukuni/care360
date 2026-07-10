import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import InvoiceLine from './invoice_line.js'
import Patient from './patient.js'
import PaymentCollection from './payment_collection.js'
import Payment from './payment.js'

export default class Invoice extends BaseModel {
  static table = 'invoices'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: number

  @column()
  declare encounterId: number | null

  @column()
  declare subscriptionId: number | null

  @column()
  declare invoiceNumber: string

  @column()
  declare status: string

  @column.dateTime()
  declare issuedAt: DateTime | null

  @column.date()
  declare dueAt: DateTime | null

  @column()
  declare totalAmount: number

  @column()
  declare balanceDue: number

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @hasMany(() => InvoiceLine, { foreignKey: 'invoiceId' })
  declare invoiceLines: HasMany<typeof InvoiceLine>

  @hasMany(() => PaymentCollection, { foreignKey: 'invoiceId' })
  declare paymentCollections: HasMany<typeof PaymentCollection>

  @hasMany(() => Payment, { foreignKey: 'invoiceId' })
  declare payments: HasMany<typeof Payment>

}
