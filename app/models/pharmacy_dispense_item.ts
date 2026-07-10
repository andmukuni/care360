import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Medication from './medication.js'
import PharmacyDispense from './pharmacy_dispense.js'
import PharmacyPrescriptionItem from './pharmacy_prescription_item.js'

export default class PharmacyDispenseItem extends BaseModel {
  static table = 'pharmacy_dispense_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare pharmacyDispenseId: number

  @column()
  declare pharmacyPrescriptionItemId: number | null

  @column()
  declare medicationId: number | null

  @column()
  declare drugName: string

  @column()
  declare quantityDispensed: number

  @column()
  declare batchNo: string | null

  @column()
  declare stockReference: string | null

  @column()
  declare instructions: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => PharmacyDispense, { foreignKey: 'pharmacyDispenseId' })
  declare pharmacyDispense: BelongsTo<typeof PharmacyDispense>

  @belongsTo(() => PharmacyPrescriptionItem, { foreignKey: 'pharmacyPrescriptionItemId' })
  declare pharmacyPrescriptionItem: BelongsTo<typeof PharmacyPrescriptionItem>

  @belongsTo(() => Medication, { foreignKey: 'medicationId' })
  declare medication: BelongsTo<typeof Medication>

}
