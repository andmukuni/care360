import { DateTime } from 'luxon'
import type Encounter from '#models/encounter'
import type LabResult from '#models/lab_result'
import type Patient from '#models/patient'
import type ScreeningRecord from '#models/screening_record'
import { AncRegisterColumns } from './anc_register_columns.js'
import { ageInYears, diffInDays, filled, fmtYmd, type CsvValue } from './support.js'

/**
 * Maps screening records to MoH ANC register rows (59 columns).
 * Ported from App\Support\Reports\AncRegisterRowMapper.
 *
 * `clinicianName` is resolved by the caller (the ScreeningRecord model has no
 * clinician relation) — the writer builds a clinician lookup per chunk.
 */
export class AncRegisterRowMapper {
  toRow(record: ScreeningRecord, contactCount: number, clinicianName = ''): CsvValue[] {
    const row: CsvValue[] = new Array(AncRegisterColumns.headers().length).fill('')
    const patient = record.patient ?? null
    const encounter = record.encounter ?? null
    const visitDate = record.screeningStartedAt ?? record.createdAt ?? DateTime.now()
    const onArt = filled(patient?.artNumber)
    const lmp = record.lastMenstrualPeriod ?? null
    const hivResults = this.hivLabResults(encounter)

    this.set(row, 'Client Name', patient?.fullName ?? '')
    this.set(row, 'SM Number', patient?.nupn || patient?.patientId || '')
    this.set(row, 'Age', this.ageAtVisit(patient?.dateOfBirth ?? null, visitDate))
    this.set(row, 'Marital Status', patient?.maritalStatus ?? '')
    this.set(row, 'Phone', patient?.phoneNumber ?? '')
    this.set(row, 'Address', this.formatAddress(patient))
    this.set(row, 'Gravida', record.gravida !== null ? String(record.gravida) : '')
    this.set(row, 'Parity', record.para !== null ? String(record.para) : '')
    this.set(row, 'Date of LMP', lmp ? fmtYmd(lmp) : '')
    this.set(row, 'EDD', record.expectedDeliveryDate ? fmtYmd(record.expectedDeliveryDate) : '')
    this.set(row, 'Known HIV+', onArt ? 'Yes' : 'No')
    this.set(row, 'Already on ART at 1st visit', onArt ? 'Yes' : 'No')
    this.set(row, 'Contact Count Number', String(contactCount))
    this.set(row, 'Date of this Visit', fmtYmd(visitDate))
    this.set(row, 'Gestation (weeks)', this.gestationWeeks(lmp, visitDate))
    this.set(row, 'Blood Pressure', this.bloodPressure(encounter))
    this.set(row, 'Weight', this.formatDecimal(encounter?.triageRecords?.[0]?.weight))
    this.set(
      row,
      'Haemoglobin',
      this.labResultByTest(encounter, (name) => name.includes('haemoglobin'))
    )
    this.set(
      row,
      'Urine Protein',
      this.labResultByTest(
        encounter,
        (name) => name.includes('urine') || name.includes('urinalysis')
      )
    )
    this.set(
      row,
      'Glucose',
      this.labResultByTest(encounter, (name) => name.includes('glucose'))
    )
    this.set(
      row,
      'Syphilis Test',
      this.labResultByTest(encounter, (name) => name.includes('syphilis') || name.includes('vdrl'))
    )
    this.set(
      row,
      'Hepatitis B Screening',
      this.labResultByTest(
        encounter,
        (name) => name.includes('hepatitis b') || name.includes('hbsag')
      )
    )
    this.set(row, 'Initial HIV Test', hivResults[0]?.resultText || hivResults[0]?.resultValue || '')
    this.set(
      row,
      'Sub-sequent HIV Tests',
      hivResults.length > 1 ? hivResults[1]?.resultText || hivResults[1]?.resultValue || '' : ''
    )

    const recency = this.recencyTestValue(encounter)
    AncRegisterColumns.headers().forEach((header, index) => {
      if (header === 'Recency Test') {
        row[index] = recency
      }
    })

    this.set(row, 'ART Number', patient?.artNumber ?? '')
    this.set(
      row,
      'Viral Load Result',
      this.labResultByTest(encounter, (name) => name.includes('viral load'))
    )
    this.set(
      row,
      'Breast Cancer screening',
      record.cervicalScreeningDone === true
        ? 'Yes'
        : record.cervicalScreeningDone === false
          ? 'No'
          : ''
    )
    this.set(
      row,
      'Suspected Breast Cancer',
      record.cervicalScreeningResult === 'suspicious_cancer' ? 'Yes' : 'No'
    )
    this.set(row, 'TB', this.tbStatus(record))
    this.set(
      row,
      'Previous or Present Conditions Requiring Special Attention',
      this.conditionsText(record)
    )
    this.set(row, 'Name of Service Provider', clinicianName)
    this.set(row, 'Remarks', this.remarks(record, encounter))

    return row
  }

  tbStatus(record: ScreeningRecord): string {
    return this.tbStatusValue(record)
  }

  gestationDisplay(record: ScreeningRecord): string {
    const visitDate = record.screeningStartedAt ?? record.createdAt ?? DateTime.now()
    return this.gestationWeeks(record.lastMenstrualPeriod ?? null, visitDate)
  }

  private set(row: CsvValue[], header: string, value: CsvValue): void {
    const index = AncRegisterColumns.columnIndex(header)
    if (index >= 0) {
      row[index] = value ?? ''
    }
  }

  private ageAtVisit(dob: DateTime | null, visitDate: DateTime): string {
    if (!dob) {
      return ''
    }
    const years = ageInYears(dob, visitDate)
    return years === null ? '' : String(years)
  }

  private gestationWeeks(lmp: DateTime | null, visitDate: DateTime): string {
    if (!lmp) {
      return ''
    }
    if (lmp > visitDate) {
      return ''
    }
    return String(Math.floor(diffInDays(lmp, visitDate) / 7))
  }

  private formatAddress(patient: Patient | null): string {
    if (!patient) {
      return ''
    }
    return [
      patient.houseNumber,
      patient.roadStreet,
      patient.area,
      patient.cityTownVillage,
      patient.country,
    ]
      .filter((p) => filled(p))
      .join(', ')
  }

  private bloodPressure(encounter: Encounter | null): string {
    const triage = encounter?.triageRecords?.[0]
    if (!triage?.systolicBp || !triage?.diastolicBp) {
      return ''
    }
    return `${triage.systolicBp}/${triage.diastolicBp}`
  }

  private formatDecimal(value: unknown): string {
    return value !== null && value !== undefined && value !== '' ? String(value) : ''
  }

  private labResultByTest(encounter: Encounter | null, matcher: (name: string) => boolean): string {
    const labRequest = encounter?.labRequests?.[0]
    if (!labRequest) {
      return ''
    }

    for (const result of labRequest.labResults ?? []) {
      const name = (result.labRequestItem?.testName ?? '').toLowerCase()
      if (name !== '' && matcher(name)) {
        return result.resultText || result.resultValue || ''
      }
    }

    for (const item of labRequest.labRequestItems ?? []) {
      const name = (item.testName ?? '').toLowerCase()
      if (name !== '' && matcher(name)) {
        return 'Requested'
      }
    }

    return ''
  }

  private hivLabResults(encounter: Encounter | null): LabResult[] {
    const results = encounter?.labRequests?.[0]?.labResults
    if (!results) {
      return []
    }
    return results.filter((result) => {
      const name = result.labRequestItem?.testName ?? ''
      return this.isHivTestName(name) && !this.isRecencyTestName(name)
    })
  }

  private recencyTestValue(encounter: Encounter | null): string {
    const labRequest = encounter?.labRequests?.[0]
    if (!labRequest) {
      return ''
    }

    for (const result of labRequest.labResults ?? []) {
      if (this.isRecencyTestName(result.labRequestItem?.testName ?? '')) {
        return result.resultText || result.resultValue || 'YES'
      }
    }

    for (const item of labRequest.labRequestItems ?? []) {
      if (this.isRecencyTestName(item.testName)) {
        return 'YES'
      }
    }

    return 'NO'
  }

  private isHivTestName(name: string | null | undefined): boolean {
    return name !== null && name !== undefined && name.toUpperCase().includes('HIV')
  }

  private isRecencyTestName(name: string | null | undefined): boolean {
    return name !== null && name !== undefined && name.toLowerCase().includes('recency')
  }

  private tbStatusValue(record: ScreeningRecord): string {
    if (filled(record.presumptiveTbCaseNo)) {
      return 'Presumptive TB'
    }

    const symptoms = record.constitutionalSymptoms ?? ''
    const tbSymptoms = this.toArray(record.tbSymptoms)
    if (tbSymptoms.length > 0) {
      return 'TB symptoms recorded'
    }
    if (symptoms.trim() !== '' && !symptoms.toLowerCase().includes('no tb')) {
      return symptoms
    }

    return 'No TB'
  }

  private conditionsText(record: ScreeningRecord): string {
    const parts = [record.previousObstetricComplications, record.chronicConditions].filter(
      (p): p is string => filled(p)
    )
    const text = parts.join(' | ').trim()
    return text.length > 500 ? text.substring(0, 497) + '...' : text
  }

  private remarks(record: ScreeningRecord, encounter: Encounter | null): string {
    const parts = [
      record.assessmentNotes,
      record.plan,
      record.treatmentPlan,
      encounter?.closureNotes,
    ].filter((p): p is string => filled(p))
    const text = parts.join(' | ').trim()
    return text.length > 500 ? text.substring(0, 497) + '...' : text
  }

  private toArray(value: string | null | undefined): unknown[] {
    if (!value) {
      return []
    }
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
