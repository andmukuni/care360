import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { LocksEncounterRecords } from '#mixins/locks_encounter_records'
import Encounter from './encounter.js'
import Patient from './patient.js'
import PharmacyDispense from './pharmacy_dispense.js'
import PharmacyPrescriptionItem from './pharmacy_prescription_item.js'
import ScreeningRecord from './screening_record.js'
import User from './user.js'

export default class PharmacyPrescription extends compose(BaseModel, LocksEncounterRecords) {
  static table = 'pharmacy_prescriptions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare screeningRecordId: number | null

  @column()
  declare prescribedBy: number

  @column()
  declare prescriptionNumber: string

  @column()
  declare status: string

  @column()
  declare notes: string | null

  @column.dateTime()
  declare prescribedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => ScreeningRecord, { foreignKey: 'screeningRecordId' })
  declare screeningRecord: BelongsTo<typeof ScreeningRecord>

  @belongsTo(() => User, { foreignKey: 'prescribedBy' })
  declare prescribedByUser: BelongsTo<typeof User>

  @hasMany(() => PharmacyDispense, { foreignKey: 'pharmacyPrescriptionId' })
  declare pharmacyDispenses: HasMany<typeof PharmacyDispense>

  @hasMany(() => PharmacyPrescriptionItem, { foreignKey: 'pharmacyPrescriptionId' })
  declare pharmacyPrescriptionItems: HasMany<typeof PharmacyPrescriptionItem>

}
