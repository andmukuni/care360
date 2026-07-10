import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from '../mixins/soft_deletes.js'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import Appointment from './appointment.js'
import BedAssignment from './bed_assignment.js'
import Bed from './bed.js'
import CashJournalLine from './cash_journal_line.js'
import DischargeSummary from './discharge_summary.js'
import EncounterAudit from './encounter_audit.js'
import EncounterQueueTransition from './encounter_queue_transition.js'
import EncounterStageLog from './encounter_stage_log.js'
import Invoice from './invoice.js'
import LabRequest from './lab_request.js'
import LabResult from './lab_result.js'
import LabSample from './lab_sample.js'
import Patient from './patient.js'
import PharmacyDispense from './pharmacy_dispense.js'
import PharmacyPrescription from './pharmacy_prescription.js'
import PharmacyRecommendation from './pharmacy_recommendation.js'
import RegistrationRecord from './registration_record.js'
import ScreeningRecord from './screening_record.js'
import ScreeningVitalRecheck from './screening_vital_recheck.js'
import StartupMedication from './startup_medication.js'
import TriageRecord from './triage_record.js'
import User from './user.js'
import Ward from './ward.js'

export default class Encounter extends compose(BaseModel, SoftDeletes) {
  static table = 'encounters'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterNumber: string

  @column()
  declare patientId: number

  @column()
  declare appointmentId: number | null

  @column()
  declare wardId: number | null

  @column.dateTime()
  declare wardAssignedAt: DateTime | null

  @column()
  declare wardAssignedBy: number | null

  @column()
  declare currentStage: EncounterStage

  @column()
  declare currentStatus: EncounterStatus

  @column()
  declare priorityLevel: string | null

  @column()
  declare visitType: string | null

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare closedAt: DateTime | null

  @column()
  declare startedBy: number | null

  @column()
  declare closedBy: number | null

  @column()
  declare closureNotes: string | null

  @column()
  declare isLocked: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => Appointment, { foreignKey: 'appointmentId' })
  declare appointment: BelongsTo<typeof Appointment>

  @belongsTo(() => Ward, { foreignKey: 'wardId' })
  declare ward: BelongsTo<typeof Ward>

  @belongsTo(() => User, { foreignKey: 'wardAssignedBy' })
  declare wardAssignedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'startedBy' })
  declare startedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'closedBy' })
  declare closedByUser: BelongsTo<typeof User>

  @hasMany(() => BedAssignment, { foreignKey: 'encounterId' })
  declare bedAssignments: HasMany<typeof BedAssignment>

  @hasMany(() => Bed, { foreignKey: 'encounterId' })
  declare beds: HasMany<typeof Bed>

  @hasMany(() => CashJournalLine, { foreignKey: 'encounterId' })
  declare cashJournalLines: HasMany<typeof CashJournalLine>

  @hasMany(() => DischargeSummary, { foreignKey: 'encounterId' })
  declare dischargeSummaries: HasMany<typeof DischargeSummary>

  @hasMany(() => EncounterAudit, { foreignKey: 'encounterId' })
  declare encounterAudits: HasMany<typeof EncounterAudit>

  @hasMany(() => EncounterQueueTransition, { foreignKey: 'encounterId' })
  declare encounterQueueTransitions: HasMany<typeof EncounterQueueTransition>

  @hasMany(() => EncounterStageLog, { foreignKey: 'encounterId' })
  declare encounterStageLogs: HasMany<typeof EncounterStageLog>

  @hasMany(() => Invoice, { foreignKey: 'encounterId' })
  declare invoices: HasMany<typeof Invoice>

  @hasMany(() => LabRequest, { foreignKey: 'encounterId' })
  declare labRequests: HasMany<typeof LabRequest>

  @hasMany(() => LabResult, { foreignKey: 'encounterId' })
  declare labResults: HasMany<typeof LabResult>

  @hasMany(() => LabSample, { foreignKey: 'encounterId' })
  declare labSamples: HasMany<typeof LabSample>

  @hasMany(() => PharmacyDispense, { foreignKey: 'encounterId' })
  declare pharmacyDispenses: HasMany<typeof PharmacyDispense>

  @hasMany(() => PharmacyPrescription, { foreignKey: 'encounterId' })
  declare pharmacyPrescriptions: HasMany<typeof PharmacyPrescription>

  @hasMany(() => PharmacyRecommendation, { foreignKey: 'encounterId' })
  declare pharmacyRecommendations: HasMany<typeof PharmacyRecommendation>

  @hasMany(() => RegistrationRecord, { foreignKey: 'encounterId' })
  declare registrationRecords: HasMany<typeof RegistrationRecord>

  @hasMany(() => ScreeningRecord, { foreignKey: 'encounterId' })
  declare screeningRecords: HasMany<typeof ScreeningRecord>

  @hasMany(() => ScreeningVitalRecheck, { foreignKey: 'encounterId' })
  declare screeningVitalRechecks: HasMany<typeof ScreeningVitalRecheck>

  @hasMany(() => StartupMedication, { foreignKey: 'encounterId' })
  declare startupMedications: HasMany<typeof StartupMedication>

  @hasMany(() => TriageRecord, { foreignKey: 'encounterId' })
  declare triageRecords: HasMany<typeof TriageRecord>

  static clinicalPriorityRankSql(column: string): string {
    return `CASE ${column} WHEN 'emergency' THEN 1 WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END`
  }

  static orderByClinicalPriority(
    query: ModelQueryBuilderContract<typeof Encounter>,
    tieBreaker = 'started_at',
    direction: 'asc' | 'desc' = 'asc'
  ) {
    const table = Encounter.table
    const rankSql = Encounter.clinicalPriorityRankSql(`${table}.priority_level`)

    return query.orderByRaw(`${rankSql} asc`).orderBy(`${table}.${tieBreaker}`, direction)
  }

  static orderByLabQueuePriority(
    query: ModelQueryBuilderContract<typeof Encounter>,
    tieBreaker = 'updated_at',
    direction: 'asc' | 'desc' = 'asc'
  ) {
    const table = Encounter.table
    const encRank = Encounter.clinicalPriorityRankSql(`${table}.priority_level`)
    const labRank = Encounter.clinicalPriorityRankSql('lab_requests.priority_level')

    return query
      .leftJoin('lab_requests', 'lab_requests.encounter_id', '=', `${table}.id`)
      .select(`${table}.*`)
      .orderByRaw(
        `CASE
          WHEN (${encRank}) = 1 OR (${labRank}) = 1 THEN 1
          WHEN (${encRank}) = 2 OR (${labRank}) = 2 THEN 2
          WHEN (${encRank}) = 3 OR (${labRank}) = 3 THEN 3
          ELSE 4
        END asc`
      )
      .orderBy(`${table}.${tieBreaker}`, direction)
  }
}
