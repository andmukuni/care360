import { DateTime } from 'luxon'
import type Encounter from '#models/encounter'
import type LabRequestItem from '#models/lab_request_item'
import type LabResult from '#models/lab_result'
import type Patient from '#models/patient'
import type ScreeningRecord from '#models/screening_record'
import { OpdRegisterColumns } from './opd_register_columns.js'
import { ageInYears, filled, fmtYmd, type CsvValue } from './support.js'

/**
 * Maps OPD encounters to MoH OPD register rows (21 columns).
 * Ported from App\Support\Reports\OpdRegisterRowMapper.
 *
 * Note: Adonis relations are plural (`screeningRecords`, `labRequests`) where
 * the Laravel model exposed hasOne singulars; this mapper reads the first
 * loaded record to preserve the original one-per-encounter semantics.
 */
export class OpdRegisterRowMapper {
  toRow(encounter: Encounter): CsvValue[] {
    const row: CsvValue[] = new Array(OpdRegisterColumns.headers().length).fill('')
    const patient = encounter.patient ?? null
    const screening = encounter.screeningRecords?.[0] ?? null
    const visitDate = encounter.startedAt ?? DateTime.now()
    const [firstName, surname] = this.splitName(patient?.fullName ?? '')
    const diagnosis = this.parseDiagnosis(screening)
    const hiv = this.hivFields(encounter)

    this.set(row, 'NUPN', patient?.nupn || patient?.patientId || '')
    this.set(row, 'Encounter Date', fmtYmd(visitDate))
    this.set(row, 'FirstName', firstName)
    this.set(row, 'Surname', surname)
    this.set(row, 'Age', this.ageAtVisit(patient?.dateOfBirth ?? null, visitDate))
    this.set(row, 'Sex', patient?.gender ?? '')
    this.set(row, 'Phone No', patient?.phoneNumber ?? '')
    this.set(row, 'Address', this.formatAddress(patient))
    this.set(row, 'Screened with HIV Screening Tool', hiv.screened)
    this.set(row, 'Test Modality', hiv.modality)
    this.set(row, 'HIV Tested', hiv.tested)
    this.set(row, 'HIV Test Result', hiv.result)
    this.set(row, 'Reffered for ART', filled(patient?.artNumber) ? 'Yes' : 'No')
    this.set(row, 'Recency Test Done', this.recencyTestDone(encounter))
    this.set(row, 'TB Status', this.tbStatus(screening))
    this.set(row, 'Diagnosis', diagnosis.text)
    this.set(row, 'ICD11 Code', diagnosis.icd11)
    this.set(row, 'Treatment Given', this.treatmentGiven(screening))
    this.set(row, 'Remarks', this.remarks(encounter, screening))

    return row
  }

  diagnosisText(screening: ScreeningRecord | null): string {
    return this.parseDiagnosis(screening).text
  }

  tbStatus(screening: ScreeningRecord | null): string {
    return this.tbStatusValue(screening)
  }

  hivResult(encounter: Encounter): string {
    return this.hivFields(encounter).result
  }

  private parseDiagnosis(screening: ScreeningRecord | null): { text: string; icd11: string } {
    const raw = String(screening?.finalDiagnosis || screening?.provisionalDiagnosis || '').trim()
    if (raw === '') {
      return { text: '', icd11: '' }
    }

    let decoded: any = null
    try {
      decoded = JSON.parse(raw)
    } catch {
      decoded = null
    }

    if (decoded && typeof decoded === 'object') {
      const icd11 = String(decoded.icd11 ?? '').trim()
      const path = decoded.path ?? decoded.level3 ?? decoded.level2 ?? decoded.level1 ?? null
      if (typeof path === 'string' && path !== '') {
        return { text: path, icd11 }
      }
      if (icd11 !== '') {
        return { text: raw, icd11 }
      }
    }

    return { text: raw, icd11: '' }
  }

  private hivFields(encounter: Encounter): {
    screened: string
    modality: string
    tested: string
    result: string
  } {
    const items = this.hivLabItems(encounter)
    const results = this.hivLabResults(encounter)

    if (items.length === 0 && results.length === 0) {
      return { screened: 'NO', modality: '', tested: 'NO', result: '' }
    }

    const result = results[0] ?? null
    const item = items[0] ?? result?.labRequestItem ?? null

    return {
      screened: 'YES',
      modality: item?.testName ?? '',
      tested: results.length > 0 || items.length > 0 ? 'YES' : 'NO',
      result: result?.resultText || result?.resultValue || '',
    }
  }

  private hivLabItems(encounter: Encounter): LabRequestItem[] {
    const items = encounter.labRequests?.[0]?.labRequestItems
    if (!items) {
      return []
    }
    return items.filter((item) => this.isHivTestName(item.testName))
  }

  private hivLabResults(encounter: Encounter): LabResult[] {
    const results = encounter.labRequests?.[0]?.labResults
    if (!results) {
      return []
    }
    return results.filter((result) => {
      const name = result.labRequestItem?.testName ?? ''
      return this.isHivTestName(name) && !this.isRecencyTestName(name)
    })
  }

  private isHivTestName(name: string | null | undefined): boolean {
    return name !== null && name !== undefined && name.toUpperCase().includes('HIV')
  }

  private isRecencyTestName(name: string | null | undefined): boolean {
    return name !== null && name !== undefined && name.toLowerCase().includes('recency')
  }

  private recencyTestDone(encounter: Encounter): string {
    const labRequest = encounter.labRequests?.[0] ?? null
    if (!labRequest) {
      return ''
    }

    for (const result of labRequest.labResults ?? []) {
      if (this.isRecencyTestName(result.labRequestItem?.testName ?? '')) {
        return 'YES'
      }
    }

    for (const item of labRequest.labRequestItems ?? []) {
      if (this.isRecencyTestName(item.testName)) {
        return 'YES'
      }
    }

    return 'NO'
  }

  private tbStatusValue(screening: ScreeningRecord | null): string {
    if (!screening) {
      return ''
    }

    if (filled(screening.presumptiveTbCaseNo)) {
      return 'Presumptive TB'
    }

    const symptoms = screening.constitutionalSymptoms ?? ''
    const tbSymptoms = this.toArray(screening.tbSymptoms)
    if (tbSymptoms.length > 0) {
      return 'TB symptoms recorded'
    }
    if (symptoms.trim() !== '' && !symptoms.toLowerCase().includes('no tb')) {
      return symptoms
    }

    return 'No TB'
  }

  private treatmentGiven(screening: ScreeningRecord | null): string {
    const text = String(screening?.treatmentPlan || screening?.plan || '').trim()
    return text.length > 500 ? text.substring(0, 497) + '...' : text
  }

  private remarks(encounter: Encounter, screening: ScreeningRecord | null): string {
    const parts = [screening?.assessmentNotes, encounter.closureNotes].filter(
      (p): p is string => filled(p)
    )
    const text = parts.join(' | ').trim()
    return text.length > 500 ? text.substring(0, 497) + '...' : text
  }

  private splitName(fullName: string): [string, string] {
    const name = fullName.trim()
    if (name === '') {
      return ['', '']
    }
    const parts = name.split(/\s+/)
    if (parts.length === 1) {
      return [parts[0], '']
    }
    const surname = parts.pop() as string
    return [parts.join(' '), surname]
  }

  private set(row: CsvValue[], header: string, value: CsvValue): void {
    const index = OpdRegisterColumns.columnIndex(header)
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
