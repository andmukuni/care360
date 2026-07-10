import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ScreeningRecord from '#models/screening_record'
import LabRequest from '#models/lab_request'
import TriageRecord from '#models/triage_record'
import RegistrationRecord from '#models/registration_record'
import PharmacyPrescription from '#models/pharmacy_prescription'
import PharmacyDispense from '#models/pharmacy_dispense'

/**
 * Resolver helpers reproducing the singular "of-many" relationships that the
 * Laravel Encounter model exposes (registrationRecord, triageRecord,
 * screeningRecord, screeningReviewRecord, labRequest, prescription, dispense).
 *
 * The Lucid Encounter model only declares the plural hasMany relations, so the
 * encounter services/actions use these helpers to fetch the specific record the
 * original code relied on.
 */

export function getRegistrationRecord(
  encounterId: number,
  client?: TransactionClientContract
): Promise<RegistrationRecord | null> {
  return RegistrationRecord.query({ client })
    .where('encounter_id', encounterId)
    .orderBy('id', 'asc')
    .first()
}

export function getTriageRecord(
  encounterId: number,
  client?: TransactionClientContract
): Promise<TriageRecord | null> {
  return TriageRecord.query({ client })
    .where('encounter_id', encounterId)
    .orderBy('id', 'asc')
    .first()
}

/** Latest `initial` screening record (Laravel: screeningRecord / ofMany id max). */
export function getInitialScreeningRecord(
  encounterId: number,
  client?: TransactionClientContract
): Promise<ScreeningRecord | null> {
  return ScreeningRecord.query({ client })
    .where('encounter_id', encounterId)
    .where('screening_type', 'initial')
    .orderBy('id', 'desc')
    .first()
}

/** Latest `review_after_lab` screening record (Laravel: screeningReviewRecord). */
export function getReviewScreeningRecord(
  encounterId: number,
  client?: TransactionClientContract
): Promise<ScreeningRecord | null> {
  return ScreeningRecord.query({ client })
    .where('encounter_id', encounterId)
    .where('screening_type', 'review_after_lab')
    .orderBy('id', 'desc')
    .first()
}

export function getLabRequest(
  encounterId: number,
  client?: TransactionClientContract
): Promise<LabRequest | null> {
  return LabRequest.query({ client })
    .where('encounter_id', encounterId)
    .orderBy('id', 'asc')
    .first()
}

/** Latest prescription (Laravel: prescription / latestOfMany). */
export function getLatestPrescription(
  encounterId: number,
  client?: TransactionClientContract
): Promise<PharmacyPrescription | null> {
  return PharmacyPrescription.query({ client })
    .where('encounter_id', encounterId)
    .orderBy('id', 'desc')
    .first()
}

/** Active prescription authored during a specific screening record (autosave upsert target). */
export function getPrescriptionForScreeningRecord(
  encounterId: number,
  screeningRecordId: number,
  client?: TransactionClientContract
): Promise<PharmacyPrescription | null> {
  return PharmacyPrescription.query({ client })
    .where('encounter_id', encounterId)
    .where('screening_record_id', screeningRecordId)
    .where('status', 'active')
    .orderBy('id', 'desc')
    .first()
}

/** Keep only the latest prescription per screening record (null = pharmacy-stage). */
export function dedupePrescriptionsByScreeningRecord(
  prescriptions: PharmacyPrescription[]
): PharmacyPrescription[] {
  const byKey = new Map<string, PharmacyPrescription>()

  for (const prescription of prescriptions) {
    const key =
      prescription.screeningRecordId === null ? 'null' : String(prescription.screeningRecordId)
    const existing = byKey.get(key)
    if (!existing || prescription.id > existing.id) {
      byKey.set(key, prescription)
    }
  }

  return [...byKey.values()].sort((a, b) => a.id - b.id)
}

/** Latest dispense (Laravel: dispense / latestOfMany). */
export function getLatestDispense(
  encounterId: number,
  client?: TransactionClientContract
): Promise<PharmacyDispense | null> {
  return PharmacyDispense.query({ client })
    .where('encounter_id', encounterId)
    .orderBy('id', 'desc')
    .first()
}
