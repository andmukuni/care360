import { DateTime } from 'luxon'
import type Patient from '#models/patient'
import type ScreeningRecord from '#models/screening_record'
import { PncRegisterColumns } from './pnc_register_columns.js'
import { ageInYears, filled, fmtYmd, type CsvValue } from './support.js'

/**
 * Maps screening records to MoH PNC register rows (62 columns).
 * Ported from App\Support\Reports\PncRegisterRowMapper.
 */
export class PncRegisterRowMapper {
  toRow(record: ScreeningRecord, visitCount: number, clinicianName = ''): CsvValue[] {
    const row: CsvValue[] = new Array(PncRegisterColumns.headers().length).fill('')
    const patient = record.patient ?? null
    const visitDate = record.screeningStartedAt ?? record.createdAt ?? DateTime.now()
    const onArt = filled(patient?.artNumber)

    this.set(row, 'Client Name', patient?.fullName ?? '')
    this.set(row, 'SM Number', patient?.nupn || patient?.patientId || '')
    this.set(row, 'Age', this.ageAtVisit(patient?.dateOfBirth ?? null, visitDate))
    this.set(row, 'Marital Status', patient?.maritalStatus ?? '')
    this.set(row, 'Physical Address/Contact', this.formatContact(patient))
    this.set(row, 'Known HIV+', onArt ? 'Yes' : 'No')
    this.set(row, 'Visit Count', String(visitCount))
    this.set(row, 'Date of  this visit', fmtYmd(visitDate))
    this.set(row, 'Birth Weight', record.birthWeight !== null ? String(record.birthWeight) : '')
    this.set(
      row,
      'Lactating',
      record.isBreastFeedingWell === true
        ? 'Yes'
        : record.isBreastFeedingWell === false
          ? 'No'
          : ''
    )
    this.set(
      row,
      'Breast Condition',
      `${record.feedingCode ?? ''} ${record.feedingComments ?? ''}`.trim()
    )
    this.set(row, 'HIV Status Before this Visit', onArt ? 'Positive' : '')
    this.set(row, 'Already on ART', onArt ? 'Yes' : 'No')
    this.set(row, 'Counselling', record.usingContraception ? 'Yes' : '')
    this.set(row, 'Method', record.contraceptiveMethod ?? '')
    this.set(row, 'Screening', record.cervicalScreeningResult ?? '')
    this.set(row, 'Treatment', record.cervicalTreatmentType ?? '')
    this.set(row, 'Name of Service Provider', clinicianName)
    this.set(row, 'Remarks', this.remarks(record))

    return row
  }

  private set(row: CsvValue[], header: string, value: CsvValue): void {
    const index = PncRegisterColumns.columnIndex(header)
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

  private formatContact(patient: Patient | null): string {
    if (!patient) {
      return ''
    }
    return [patient.phoneNumber, patient.cityTownVillage, patient.area, patient.roadStreet]
      .filter((p) => filled(p))
      .join(', ')
  }

  private remarks(record: ScreeningRecord): string {
    const text = String(record.assessmentNotes || record.plan || '').trim()
    return text.length > 500 ? text.substring(0, 497) + '...' : text
  }
}
