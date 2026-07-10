import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { LocksEncounterRecords } from '#mixins/locks_encounter_records'
import Encounter from './encounter.js'
import Patient from './patient.js'

export default class RegistrationRecord extends compose(BaseModel, LocksEncounterRecords) {
  static table = 'registration_records'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare registrarId: number

  @column()
  declare wasExistingPatient: boolean

  @column()
  declare attendantType: string

  @column()
  declare searchReference: string | null

  @column()
  declare registrationNotes: string | null

  @column.dateTime()
  declare registeredAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

}
