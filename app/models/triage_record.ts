import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { LocksEncounterRecords } from '#mixins/locks_encounter_records'
import Encounter from './encounter.js'
import Patient from './patient.js'
import StartupMedication from './startup_medication.js'

export default class TriageRecord extends compose(BaseModel, LocksEncounterRecords) {
  static table = 'triage_records'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare nurseId: number

  @column()
  declare weight: number | null

  @column()
  declare height: number | null

  @column()
  declare bmi: number | null

  @column()
  declare temperature: number | null

  @column()
  declare pulse: number | null

  @column()
  declare respiratoryRate: number | null

  @column()
  declare systolicBp: number | null

  @column()
  declare diastolicBp: number | null

  @column()
  declare oxygenSaturation: number | null

  @column()
  declare bloodSugar: number | null

  @column()
  declare muac: number | null

  @column()
  declare muacScore: string | null

  @column()
  declare abdominalCircumference: number | null

  @column()
  declare painScale: number | null

  @column()
  declare chiefComplaintBrief: string | null

  @column()
  declare startupInterventionsNotes: string | null

  @column()
  declare startupMedicationsNotes: string | null

  @column()
  declare triageNotes: string | null

  @column.dateTime()
  declare triageAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @hasMany(() => StartupMedication, { foreignKey: 'triageRecordId' })
  declare startupMedications: HasMany<typeof StartupMedication>

}
