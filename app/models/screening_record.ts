import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { LocksEncounterRecords } from '#mixins/locks_encounter_records'
import Encounter from './encounter.js'
import LabRequest from './lab_request.js'
import Patient from './patient.js'
import PharmacyPrescription from './pharmacy_prescription.js'
import ScreeningStaffAssignment from './screening_staff_assignment.js'
import ScreeningVitalRecheck from './screening_vital_recheck.js'

export default class ScreeningRecord extends compose(BaseModel, LocksEncounterRecords) {
  static table = 'screening_records'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare patientId: number

  @column()
  declare clinicianId: number

  @column()
  declare screeningType: string

  @column()
  declare complaints: string | null

  @column()
  declare tbSymptoms: string | null

  @column()
  declare constitutionalSymptoms: string | null

  @column()
  declare presumptiveTbCaseNo: string | null

  @column()
  declare reviewOfSystems: string | null

  @column()
  declare historyOfPresentingIllness: string | null

  @column()
  declare pastMedicalHistory: string | null

  @column()
  declare medicationHistory: string | null

  @column()
  declare allergyHistory: string | null

  @column()
  declare chronicConditions: string | null

  @column()
  declare familyHistory: string | null

  @column()
  declare socialHistory: string | null

  @column()
  declare menstrualCycleRegularity: string | null

  @column()
  declare cycleLengthDays: number | null

  @column()
  declare durationOfFlowDays: number | null

  @column.date()
  declare lastMenstrualPeriod: DateTime | null

  @column()
  declare dysmenorrhoea: boolean | null

  @column()
  declare intermenstrualBleeding: boolean | null

  @column()
  declare postCoitalBleeding: boolean | null

  @column()
  declare menstrualNotes: string | null

  @column()
  declare gravida: number | null

  @column()
  declare para: number | null

  @column()
  declare abortus: number | null

  @column()
  declare livingChildren: number | null

  @column()
  declare currentlyPregnant: boolean | null

  @column.date()
  declare expectedDeliveryDate: DateTime | null

  @column()
  declare previousObstetricComplications: string | null

  @column()
  declare obstetricsNotes: string | null

  @column()
  declare usingContraception: boolean | null

  @column()
  declare contraceptiveMethod: string | null

  @column()
  declare contraceptiveMethodOther: string | null

  @column()
  declare contraceptiveDurationMonths: number | null

  @column()
  declare previousContraceptiveMethods: string | null

  @column()
  declare contraceptiveNotes: string | null

  @column()
  declare cervicalScreeningDone: boolean | null

  @column.date()
  declare cervicalScreeningDate: DateTime | null

  @column()
  declare cervicalScreeningMethod: string | null

  @column()
  declare cervicalScreeningResult: string | null

  @column()
  declare cervicalScreeningResultNotes: string | null

  @column()
  declare cervicalTreatmentDone: boolean | null

  @column()
  declare cervicalTreatmentType: string | null

  @column()
  declare cervicalCancerNotes: string | null

  @column()
  declare birthWeight: number | null

  @column()
  declare birthLength: number | null

  @column()
  declare headCircumference: number | null

  @column()
  declare chestCircumference: number | null

  @column()
  declare generalCondition: string | null

  @column()
  declare isBreastFeedingWell: boolean | null

  @column()
  declare otherFeedingOption: string | null

  @column()
  declare deliveryTime: string | null

  @column()
  declare vaccinationOutside: string | null

  @column()
  declare tetanusAtBirth: string | null

  @column()
  declare birthOutcome: string | null

  @column()
  declare birthNotes: string | null

  @column()
  declare immunizationHistory: string | null

  @column()
  declare feedingCode: string | null

  @column()
  declare feedingComments: string | null

  @column()
  declare developmentHistory: string | null

  @column()
  declare physicalExamination: string | null

  @column()
  declare clinicalFindings: string | null

  @column()
  declare provisionalDiagnosis: string | null

  @column()
  declare finalDiagnosis: string | null

  @column()
  declare assessmentNotes: string | null

  @column()
  declare plan: string | null

  @column()
  declare treatmentPlan: string | null

  @column()
  declare visibleToPatient: boolean

  @column()
  declare labRequested: boolean

  @column.dateTime()
  declare referredToLabAt: DateTime | null

  @column.dateTime()
  declare returnedFromLabAt: DateTime | null

  @column()
  declare reviewNotes: string | null

  @column()
  declare prescribed: boolean

  @column.dateTime()
  declare screeningStartedAt: DateTime | null

  @column.dateTime()
  declare screeningCompletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @hasMany(() => LabRequest, { foreignKey: 'screeningRecordId' })
  declare labRequests: HasMany<typeof LabRequest>

  @hasMany(() => PharmacyPrescription, { foreignKey: 'screeningRecordId' })
  declare pharmacyPrescriptions: HasMany<typeof PharmacyPrescription>

  @hasMany(() => ScreeningStaffAssignment, { foreignKey: 'screeningRecordId' })
  declare screeningStaffAssignments: HasMany<typeof ScreeningStaffAssignment>

  @hasMany(() => ScreeningVitalRecheck, { foreignKey: 'screeningRecordId' })
  declare screeningVitalRechecks: HasMany<typeof ScreeningVitalRecheck>

}
