import BedAssignment from '#models/bed_assignment'
import DischargeSummary from '#models/discharge_summary'
import Encounter from '#models/encounter'
import LabRequest from '#models/lab_request'
import LabResult from '#models/lab_result'
import Patient from '#models/patient'
import PharmacyPrescription from '#models/pharmacy_prescription'
import ScreeningRecord from '#models/screening_record'
import TriageRecord from '#models/triage_record'
import DiagnosisFormatter from '#services/portal/diagnosis_formatter'
import { abortIf } from '#services/portal/portal_errors'

/**
 * Read model for the patient portal health-records screens.
 *
 * Ported from App\Services\Portal\PatientMedicalSummaryService.
 *
 * PORT-GAP: the Laravel Encounter model declares singular hasOne relations
 * (triageRecord, screeningRecord, screeningReviewRecord, labRequest, prescription)
 * that the AdonisJS Encounter model does not. This port preloads the equivalent
 * plural hasMany relations that DO exist (triageRecords, screeningRecords,
 * labRequests, pharmacyPrescriptions, pharmacyDispenses). Screening "initial" vs
 * "review_after_lab" records are both included in `screeningRecords` (filter by
 * `screeningType`). `page` params were added because Lucid `.paginate()` requires
 * an explicit page (Laravel read it from the request automatically).
 */
export default class PatientMedicalSummaryService {
  async recentEncounters(patient: Patient, limit: number = 5): Promise<Encounter[]> {
    return Encounter.query()
      .where('patientId', patient.id)
      .preload('triageRecords')
      .preload('screeningRecords')
      .orderBy('startedAt', 'desc')
      .limit(limit)
  }

  async paginatedEncounters(patient: Patient, perPage: number = 15, page: number = 1) {
    return Encounter.query()
      .where('patientId', patient.id)
      .preload('triageRecords')
      .preload('screeningRecords')
      .orderBy('startedAt', 'desc')
      .paginate(page, perPage)
  }

  async encounterForPatient(patient: Patient, encounter: Encounter): Promise<Encounter> {
    abortIf(Number(encounter.patientId) !== Number(patient.id), 403)

    await encounter.load('triageRecords')
    await encounter.load('screeningRecords')
    await encounter.load('labRequests', (query) => {
      query.preload('labResults', (results) => {
        results.whereNotNull('releasedToPatientAt').preload('labRequestItem')
      })
    })
    await encounter.load('pharmacyPrescriptions', (query) => {
      query.preload('pharmacyPrescriptionItems')
    })

    return encounter
  }

  async diagnosisSummaryForEncounter(encounter: Encounter): Promise<string[]> {
    const records = await ScreeningRecord.query()
      .where('encounterId', encounter.id)
      .whereIn('screeningType', ['initial', 'review_after_lab'])
      .orderBy('id', 'desc')

    const initial = records.find((r) => r.screeningType === 'initial') ?? null
    const review = records.find((r) => r.screeningType === 'review_after_lab') ?? null

    const diagnoses: string[] = []

    for (const record of [initial, review]) {
      if (!record) {
        continue
      }

      for (const field of ['finalDiagnosis', 'provisionalDiagnosis'] as const) {
        const value = DiagnosisFormatter.format(record[field] ?? null)
        if (value !== '') {
          diagnoses.push(value)
        }
      }
    }

    return [...new Set(diagnoses)]
  }

  async paginatedDiagnoses(patient: Patient, perPage: number = 20, page: number = 1) {
    return ScreeningRecord.query()
      .where('patientId', patient.id)
      .where((query) => {
        query
          .where((inner) => {
            inner.whereNotNull('finalDiagnosis').whereNot('finalDiagnosis', '')
          })
          .orWhere((inner) => {
            inner.whereNotNull('provisionalDiagnosis').whereNot('provisionalDiagnosis', '')
          })
      })
      .preload('encounter')
      .orderBy('createdAt', 'desc')
      .paginate(page, perPage)
  }

  async paginatedLabRequests(patient: Patient, perPage: number = 20, page: number = 1) {
    return LabRequest.query()
      .where('patientId', patient.id)
      .preload('labRequestItems')
      .preload('encounter')
      .orderBy('requestedAt', 'desc')
      .paginate(page, perPage)
  }

  async labRequestForPatient(patient: Patient, labRequest: LabRequest): Promise<LabRequest> {
    abortIf(Number(labRequest.patientId) !== Number(patient.id), 403)

    await labRequest.load('labRequestItems')
    await labRequest.load('labResults', (query) => {
      query.whereNotNull('releasedToPatientAt').preload('labRequestItem')
    })
    await labRequest.load('encounter')
    await labRequest.load('requestedByUser')

    return labRequest
  }

  async paginatedLabResults(patient: Patient, perPage: number = 20, page: number = 1) {
    return LabResult.query()
      .where('patientId', patient.id)
      .whereNotNull('releasedToPatientAt')
      .preload('labRequestItem')
      .preload('encounter')
      .orderBy('releasedToPatientAt', 'desc')
      .paginate(page, perPage)
  }

  async labResultForPatient(patient: Patient, result: LabResult): Promise<LabResult> {
    abortIf(Number(result.patientId) !== Number(patient.id), 403)
    abortIf(result.releasedToPatientAt === null, 403)

    await result.load('labRequestItem')
    await result.load('encounter')
    await result.load('patient')

    return result
  }

  async recentReleasedLabResults(patient: Patient, limit: number = 3): Promise<LabResult[]> {
    return LabResult.query()
      .where('patientId', patient.id)
      .whereNotNull('releasedToPatientAt')
      .preload('labRequestItem')
      .orderBy('releasedToPatientAt', 'desc')
      .limit(limit)
  }

  async paginatedPrescriptions(patient: Patient, perPage: number = 15, page: number = 1) {
    return PharmacyPrescription.query()
      .where('patientId', patient.id)
      .preload('pharmacyPrescriptionItems')
      .preload('encounter')
      .preload('pharmacyDispenses', (query) => {
        query.preload('pharmacyDispenseItems')
      })
      .orderBy('prescribedAt', 'desc')
      .paginate(page, perPage)
  }

  async prescriptionForPatient(
    patient: Patient,
    prescription: PharmacyPrescription
  ): Promise<PharmacyPrescription> {
    abortIf(Number(prescription.patientId) !== Number(patient.id), 403)

    await prescription.load('pharmacyPrescriptionItems')
    await prescription.load('pharmacyDispenses', (query) => {
      query.preload('pharmacyDispenseItems')
    })
    await prescription.load('encounter')
    await prescription.load('prescribedByUser')

    return prescription
  }

  async recentPrescriptions(patient: Patient, limit: number = 3): Promise<PharmacyPrescription[]> {
    return PharmacyPrescription.query()
      .where('patientId', patient.id)
      .preload('pharmacyPrescriptionItems')
      .orderBy('prescribedAt', 'desc')
      .limit(limit)
  }

  async paginatedAdmissions(patient: Patient, perPage: number = 15, page: number = 1) {
    return BedAssignment.query()
      .where('patientId', patient.id)
      .preload('bed', (query) => {
        query.preload('ward')
      })
      .preload('encounter')
      .orderBy('admittedAt', 'desc')
      .paginate(page, perPage)
  }

  async dischargeSummariesForPatient(patient: Patient): Promise<DischargeSummary[]> {
    return DischargeSummary.query()
      .where('patientId', patient.id)
      .where('visibleToPatient', true)
      .orderBy('dischargedAt', 'desc')
  }

  async activeEncounter(patient: Patient): Promise<Encounter | null> {
    return Encounter.query()
      .where('patientId', patient.id)
      .whereNotIn('currentStage', ['completed'])
      .whereNull('deletedAt')
      .orderBy('startedAt', 'desc')
      .preload('triageRecords')
      .preload('screeningRecords')
      .first()
  }

  /**
   * Most recent triage vitals for the health records summary cards.
   */
  async latestVitals(patient: Patient): Promise<Record<string, string | null> | null> {
    const triage = await TriageRecord.query()
      .where('patientId', patient.id)
      .where((query) => {
        query
          .whereNotNull('systolicBp')
          .orWhereNotNull('pulse')
          .orWhereNotNull('oxygenSaturation')
          .orWhereNotNull('bloodSugar')
      })
      .orderBy('triageAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    if (!triage) {
      return null
    }

    return {
      recorded_at: triage.triageAt ? triage.triageAt.toISO() : null,
      blood_pressure:
        triage.systolicBp && triage.diastolicBp ? `${triage.systolicBp}/${triage.diastolicBp}` : null,
      blood_count: triage.oxygenSaturation !== null ? this.trimNumber(triage.oxygenSaturation, 1) : null,
      heart_rate: triage.pulse !== null ? String(triage.pulse) : null,
      glucose: triage.bloodSugar !== null ? this.trimNumber(triage.bloodSugar, 2) : null,
    }
  }

  /** Mirror of PHP rtrim(rtrim(number_format($x, $d, '.', ''), '0'), '.'). */
  private trimNumber(value: number, decimals: number): string {
    let s = Number(value).toFixed(decimals)
    if (s.includes('.')) {
      s = s.replace(/0+$/, '').replace(/\.$/, '')
    }
    return s
  }
}
