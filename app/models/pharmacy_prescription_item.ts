import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import PharmacyDispenseItem from './pharmacy_dispense_item.js'
import PharmacyPrescription from './pharmacy_prescription.js'
import User from './user.js'

export default class PharmacyPrescriptionItem extends BaseModel {
  static table = 'pharmacy_prescription_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare pharmacyPrescriptionId: number

  @column()
  declare drugId: number | null

  @column()
  declare drugName: string

  @column()
  declare strength: string | null

  @column()
  declare formulation: string | null

  @column()
  declare dose: string

  @column()
  declare itemPerDose: number | null

  @column()
  declare frequency: string

  @column()
  declare timePer: string | null

  @column()
  declare frequencyUnit: string | null

  @column()
  declare duration: string

  @column()
  declare durationUnit: string | null

  @column.date()
  declare startDate: DateTime | null

  @column.date()
  declare endDate: DateTime | null

  @column()
  declare isPasserBy: boolean

  @column()
  declare quantityPrescribed: number

  @column()
  declare route: string | null

  @column()
  declare instructions: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => PharmacyPrescription, { foreignKey: 'pharmacyPrescriptionId' })
  declare pharmacyPrescription: BelongsTo<typeof PharmacyPrescription>

  @belongsTo(() => User, { foreignKey: 'isPasserBy' })
  declare isPasserByUser: BelongsTo<typeof User>

  @hasMany(() => PharmacyDispenseItem, { foreignKey: 'pharmacyPrescriptionItemId' })
  declare pharmacyDispenseItems: HasMany<typeof PharmacyDispenseItem>

}
