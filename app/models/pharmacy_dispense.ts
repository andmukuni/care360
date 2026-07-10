import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import Patient from './patient.js'
import PharmacyDispenseItem from './pharmacy_dispense_item.js'
import PharmacyPrescription from './pharmacy_prescription.js'
import User from './user.js'

export default class PharmacyDispense extends BaseModel {
  static table = 'pharmacy_dispenses'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare pharmacyPrescriptionId: number | null

  @column()
  declare dispensedBy: number

  @column()
  declare dispensingNotes: string | null

  @column()
  declare counselingNotes: string | null

  @column.dateTime()
  declare dispensedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => PharmacyPrescription, { foreignKey: 'pharmacyPrescriptionId' })
  declare pharmacyPrescription: BelongsTo<typeof PharmacyPrescription>

  @belongsTo(() => User, { foreignKey: 'dispensedBy' })
  declare dispensedByUser: BelongsTo<typeof User>

  @hasMany(() => PharmacyDispenseItem, { foreignKey: 'pharmacyDispenseId' })
  declare pharmacyDispenseItems: HasMany<typeof PharmacyDispenseItem>

}
