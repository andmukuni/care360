import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany, afterSave, afterDelete } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import { SanctumAccessTokensProvider } from '#lib/sanctum_access_tokens_provider'
import Appointment from './appointment.js'
import BedAssignment from './bed_assignment.js'
import DischargeSummary from './discharge_summary.js'
import EmergencyContactLog from './emergency_contact_log.js'
import EncounterAudit from './encounter_audit.js'
import EncounterQueueTransition from './encounter_queue_transition.js'
import EncounterStageLog from './encounter_stage_log.js'
import Encounter from './encounter.js'
import Household from './household.js'
import Invoice from './invoice.js'
import LabRequest from './lab_request.js'
import LabResult from './lab_result.js'
import LabSample from './lab_sample.js'
import PatientAuditLog from './patient_audit_log.js'
import PatientDocument from './patient_document.js'
import PatientMessage from './patient_message.js'
import PatientRequest from './patient_request.js'
import PaymentCollection from './payment_collection.js'
import Payment from './payment.js'
import PharmacyDispense from './pharmacy_dispense.js'
import PharmacyPrescription from './pharmacy_prescription.js'
import PlatformComplaint from './platform_complaint.js'
import RegistrationRecord from './registration_record.js'
import ScreeningRecord from './screening_record.js'
import StartupMedication from './startup_medication.js'
import TriageRecord from './triage_record.js'
import WellnessFundAccount from './wellness_fund_account.js'
import WellnessFundLedgerEntry from './wellness_fund_ledger_entry.js'

/**
 * Portal patient authentication. The `patients` table stores a Laravel bcrypt
 * hash ($2y$...) in `password`; the "laravel_bcrypt" driver verifies it. Note
 * both `email` and `password` are nullable in the schema — a patient may exist
 * without portal credentials until invited, so login flows must still guard on
 * portal_enabled / status before attempting authentication.
 */
const AuthFinder = withAuthFinder(() => hash.use('laravel_bcrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class Patient extends compose(BaseModel, AuthFinder) {
  static table = 'patients'

  /**
   * Access tokens for the patient JSON/mobile API. Shares the Sanctum-compatible
   * `personal_access_tokens` table with staff tokens (differentiated by the
   * polymorphic tokenable columns).
   */
  static accessTokens = SanctumAccessTokensProvider.forModel(Patient, {
    table: 'personal_access_tokens',
    tokenableType: 'App\\Models\\Patient',
  })

  /**
   * The access token used to authenticate the current request (set by the
   * access-tokens guard). Used by the portal API middleware to revoke a token
   * when access is withdrawn.
   */
  declare currentAccessToken?: AccessToken

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare patientId: string

  @column()
  declare fullName: string

  @column()
  declare gender: string | null

  @column.date()
  declare dateOfBirth: DateTime | null

  @column()
  declare nrcNumber: string | null

  @column()
  declare country: string | null

  @column()
  declare phoneNumber: string | null

  @column()
  declare email: string | null

  @column()
  declare password: string | null

  @column()
  declare rememberToken: string | null

  @column()
  declare portalEnabled: boolean

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column()
  declare otherCellphone: string | null

  @column()
  declare landline: string | null

  @column()
  declare houseNumber: string | null

  @column()
  declare roadStreet: string | null

  @column()
  declare area: string | null

  @column()
  declare cityTownVillage: string | null

  @column()
  declare landmarks: string | null

  @column()
  declare maritalStatus: string | null

  @column()
  declare spouseFirstName: string | null

  @column()
  declare spouseSurname: string | null

  @column()
  declare homeLanguage: string | null

  @column()
  declare bornInZambia: string | null

  @column()
  declare provinceOfBirth: string | null

  @column()
  declare districtOfBirth: string | null

  @column()
  declare placeOfBirth: string | null

  @column()
  declare occupation: string | null

  @column()
  declare artNumber: string | null

  @column()
  declare nupn: string | null

  @column()
  declare bloodGroup: string | null

  @column()
  declare allergies: string | null

  @column()
  declare nextOfKinName: string | null

  @column()
  declare nextOfKinPhone: string | null

  @column()
  declare nextOfKinRelationship: string | null

  @column()
  declare relationshipToHead: string | null

  @column()
  declare householdHeadOfHouse: string | null

  @column()
  declare householdId: string | null

  @column()
  declare barcode: string | null

  @column()
  declare profilePhotoPath: string | null

  @column()
  declare status: string

  @column()
  declare isDeceased: boolean

  @column.date()
  declare deceasedAt: DateTime | null

  @column()
  declare deceasedNotes: string | null

  @column.dateTime()
  declare sourceCreatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Patient, { foreignKey: 'patientId' })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => Household, { foreignKey: 'householdId' })
  declare household: BelongsTo<typeof Household>

  @hasMany(() => Appointment, { foreignKey: 'patientId' })
  declare appointments: HasMany<typeof Appointment>

  @hasMany(() => Appointment, { foreignKey: 'requestedByPatientId' })
  declare appointments2: HasMany<typeof Appointment>

  @hasMany(() => BedAssignment, { foreignKey: 'patientId' })
  declare bedAssignments: HasMany<typeof BedAssignment>

  @hasMany(() => DischargeSummary, { foreignKey: 'patientId' })
  declare dischargeSummaries: HasMany<typeof DischargeSummary>

  @hasMany(() => EmergencyContactLog, { foreignKey: 'patientId' })
  declare emergencyContactLogs: HasMany<typeof EmergencyContactLog>

  @hasMany(() => EncounterAudit, { foreignKey: 'patientId' })
  declare encounterAudits: HasMany<typeof EncounterAudit>

  @hasMany(() => EncounterQueueTransition, { foreignKey: 'patientId' })
  declare encounterQueueTransitions: HasMany<typeof EncounterQueueTransition>

  @hasMany(() => EncounterStageLog, { foreignKey: 'patientId' })
  declare encounterStageLogs: HasMany<typeof EncounterStageLog>

  @hasMany(() => Encounter, { foreignKey: 'patientId' })
  declare encounters: HasMany<typeof Encounter>

  @hasMany(() => Invoice, { foreignKey: 'patientId' })
  declare invoices: HasMany<typeof Invoice>

  @hasMany(() => LabRequest, { foreignKey: 'patientId' })
  declare labRequests: HasMany<typeof LabRequest>

  @hasMany(() => LabResult, { foreignKey: 'patientId' })
  declare labResults: HasMany<typeof LabResult>

  @hasMany(() => LabSample, { foreignKey: 'patientId' })
  declare labSamples: HasMany<typeof LabSample>

  @hasMany(() => PatientAuditLog, { foreignKey: 'patientId' })
  declare patientAuditLogs: HasMany<typeof PatientAuditLog>

  @hasMany(() => PatientDocument, { foreignKey: 'patientId' })
  declare patientDocuments: HasMany<typeof PatientDocument>

  @hasMany(() => PatientMessage, { foreignKey: 'patientId' })
  declare patientMessages: HasMany<typeof PatientMessage>

  @hasMany(() => PatientRequest, { foreignKey: 'patientId' })
  declare patientRequests: HasMany<typeof PatientRequest>

  @hasMany(() => PaymentCollection, { foreignKey: 'patientId' })
  declare paymentCollections: HasMany<typeof PaymentCollection>

  @hasMany(() => Payment, { foreignKey: 'patientId' })
  declare payments: HasMany<typeof Payment>

  @hasMany(() => PharmacyDispense, { foreignKey: 'patientId' })
  declare pharmacyDispenses: HasMany<typeof PharmacyDispense>

  @hasMany(() => PharmacyPrescription, { foreignKey: 'patientId' })
  declare pharmacyPrescriptions: HasMany<typeof PharmacyPrescription>

  @hasMany(() => PlatformComplaint, { foreignKey: 'patientId' })
  declare platformComplaints: HasMany<typeof PlatformComplaint>

  @hasMany(() => RegistrationRecord, { foreignKey: 'patientId' })
  declare registrationRecords: HasMany<typeof RegistrationRecord>

  @hasMany(() => ScreeningRecord, { foreignKey: 'patientId' })
  declare screeningRecords: HasMany<typeof ScreeningRecord>

  @hasMany(() => StartupMedication, { foreignKey: 'patientId' })
  declare startupMedications: HasMany<typeof StartupMedication>

  @hasMany(() => TriageRecord, { foreignKey: 'patientId' })
  declare triageRecords: HasMany<typeof TriageRecord>

  @hasMany(() => WellnessFundAccount, { foreignKey: 'patientId' })
  declare wellnessFundAccounts: HasMany<typeof WellnessFundAccount>

  @hasMany(() => WellnessFundLedgerEntry, { foreignKey: 'patientId' })
  declare wellnessFundLedgerEntries: HasMany<typeof WellnessFundLedgerEntry>

  @afterSave()
  static async invalidateReferenceCache(patient: Patient) {
    const { invalidatePatientCache } = await import('#models/hooks/cache_invalidation_hooks')
    await invalidatePatientCache(patient)
  }

  @afterDelete()
  static async invalidateReferenceCacheOnDelete(patient: Patient) {
    const { invalidatePatientCache } = await import('#models/hooks/cache_invalidation_hooks')
    await invalidatePatientCache(patient)
  }
}
