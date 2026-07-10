import { DateTime } from 'luxon'
import type Encounter from '#models/encounter'
import type Patient from '#models/patient'
import type PharmacyDispense from '#models/pharmacy_dispense'
import type PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import type ScreeningRecord from '#models/screening_record'
import { ArtRegisterColumns } from './art_register_columns.js'
import { ageInYears, diffInDays, diffInMonths, filled, fmtNjY, type CsvValue } from './support.js'

/**
 * Maps ART patients to MoH ART register rows (44 columns).
 * Ported from App\Support\Reports\ArtRegisterRowMapper.
 */
export class ArtRegisterRowMapper {
  toRow(patient: Patient, reportEnd: DateTime | null = null): CsvValue[] {
    const end = reportEnd ?? DateTime.now()
    const row: CsvValue[] = new Array(ArtRegisterColumns.headers().length).fill('')
    const referenceDate = this.referenceDate(patient, end)
    const age = this.ageAt(patient.dateOfBirth ?? null, referenceDate)
    const [firstName, surname] = this.splitName(patient.fullName ?? '')
    const encounter = this.latestEncounter(patient)
    const screening = encounter?.screeningRecords?.[0] ?? null
    const arvItems = this.arvPrescriptionItems(patient)
    const latestDispense = this.latestDispense(patient)
    const artStart = this.artStartDate(patient, arvItems)
    const hivPositive = this.hivPositiveDate(patient)
    const viralLoad = this.latestViralLoad(patient)

    this.set(row, 'NUPN', patient.nupn || patient.patientId || '')
    this.set(row, 'ART No', patient.artNumber ?? '')
    this.set(row, 'Date of Birth', patient.dateOfBirth ? fmtNjY(patient.dateOfBirth) : '')
    this.set(row, 'Age', age !== null ? String(age) : '')
    this.set(row, 'Age Category', age !== null ? this.ageCategory(age) : '')
    this.set(row, 'First Name', firstName)
    this.set(row, 'Surname', surname)
    this.set(row, 'Sex', this.formatSex(patient.gender))
    this.set(row, 'Mobile', patient.phoneNumber ?? '')
    this.set(row, 'Address', this.formatAddress(patient))
    this.set(row, 'Date Tested Positive', hivPositive ? fmtNjY(hivPositive) : '')
    this.set(row, 'ART Start Date', artStart ? fmtNjY(artStart) : '')
    this.set(
      row,
      'Treatment Duration In Months',
      artStart ? String(Math.max(0, diffInMonths(artStart, referenceDate))) : ''
    )
    this.set(row, 'Pregnant', this.yesNo(screening?.currentlyPregnant ?? null))
    this.set(row, 'BreastFeeding', this.breastFeeding(screening))
    this.set(
      row,
      'Date Due for Cancer Screening',
      screening?.cervicalScreeningDate ? fmtNjY(screening.cervicalScreeningDate) : ''
    )
    this.set(row, 'TPT Initial Regime', this.tptRegimen(arvItems))
    this.set(row, 'TPT Initial Prophlaxis Start Date', '')
    this.set(row, 'TPT Prophylaxis Completion Date', '')
    this.set(row, 'TPT Units Dispensed', '')
    this.set(row, 'Eligible for TPT(3years)', '')
    const ctxStart = this.ctxStartDate(arvItems)
    this.set(row, 'CTX Start Date', ctxStart ? fmtNjY(ctxStart) : '')
    this.set(row, 'Starting Regimen', this.startingRegimen(arvItems))
    const startingRegimenDate = this.startingRegimenDate(arvItems)
    this.set(row, 'Date of Starting Regimen', startingRegimenDate ? fmtNjY(startingRegimenDate) : '')
    this.set(row, 'Last weight recorded', this.formatDecimal(encounter?.triageRecords?.[0]?.weight))
    this.set(row, 'Current Regimen', this.currentRegimen(arvItems))
    const currentRegimenStartDate = this.currentRegimenStartDate(arvItems)
    this.set(
      row,
      'Current Regimen Start Date',
      currentRegimenStartDate ? fmtNjY(currentRegimenStartDate) : ''
    )
    this.set(
      row,
      'Date of Current ARV Dispensation',
      latestDispense?.dispensedAt ? fmtNjY(latestDispense.dispensedAt) : ''
    )
    this.set(row, 'Most Recent ARV Dispensing Quantity', this.dispenseQuantity(latestDispense))
    this.set(row, 'Is on TxCURR', this.isOnTxCurr(latestDispense, end))
    this.set(row, 'Next Pharmacy Visit', '')
    this.set(row, 'Days Late', '')
    this.set(row, 'MultiMonth Dispensation', this.multiMonthDispensation(latestDispense))
    this.set(row, 'Date Enrolled in DSD', '')
    this.set(row, 'Current DSD model', '')
    this.set(row, 'Most Recent Viral Load Result', viralLoad.result)
    this.set(row, 'Most Recent Viral Load Date', viralLoad.date)
    this.set(row, 'Next Viral Load Date', '')
    this.set(row, 'Patient Status', this.patientStatus(patient))
    const eventDate = this.eventDate(patient, encounter)
    this.set(row, 'Event Date', eventDate ? fmtNjY(eventDate) : '')
    this.set(row, 'Event Details', this.eventDetails(patient))

    return row
  }

  private set(row: CsvValue[], header: string, value: CsvValue): void {
    const index = ArtRegisterColumns.columnIndex(header)
    if (index >= 0) {
      row[index] = value ?? ''
    }
  }

  private referenceDate(patient: Patient, reportEnd: DateTime): DateTime {
    if (patient.isDeceased && patient.deceasedAt) {
      const deceased = patient.deceasedAt
      return deceased <= reportEnd ? deceased : reportEnd
    }
    const encounter = this.latestEncounter(patient)
    return encounter?.startedAt ?? reportEnd
  }

  private latestEncounter(patient: Patient): Encounter | null {
    const encounters = patient.encounters ?? []
    return (
      [...encounters].sort(
        (a, b) => (b.startedAt?.toMillis() ?? 0) - (a.startedAt?.toMillis() ?? 0)
      )[0] ?? null
    )
  }

  private latestDispense(patient: Patient): PharmacyDispense | null {
    const dispenses = patient.pharmacyDispenses ?? []
    return (
      [...dispenses].sort(
        (a, b) => (b.dispensedAt?.toMillis() ?? 0) - (a.dispensedAt?.toMillis() ?? 0)
      )[0] ?? null
    )
  }

  private arvPrescriptionItems(patient: Patient): PharmacyPrescriptionItem[] {
    const items: PharmacyPrescriptionItem[] = []

    for (const prescription of patient.pharmacyPrescriptions ?? []) {
      for (const item of prescription.pharmacyPrescriptionItems ?? []) {
        if (this.isArvDrug(item.drugName)) {
          items.push(item)
        }
      }
    }

    if (items.length > 0) {
      return this.sortByStartDate(items)
    }

    const encounter = this.latestEncounter(patient)
    const prescription = encounter?.pharmacyPrescriptions?.[0]
    if (prescription) {
      for (const item of prescription.pharmacyPrescriptionItems ?? []) {
        if (this.isArvDrug(item.drugName)) {
          items.push(item)
        }
      }
    }

    return this.sortByStartDate(items)
  }

  private sortByStartDate(items: PharmacyPrescriptionItem[]): PharmacyPrescriptionItem[] {
    return [...items].sort((a, b) => (a.startDate?.toMillis() ?? 0) - (b.startDate?.toMillis() ?? 0))
  }

  private artStartDate(patient: Patient, arvItems: PharmacyPrescriptionItem[]): DateTime | null {
    const dates = arvItems.map((item) => item.startDate).filter((d): d is DateTime => !!d)
    if (dates.length > 0) {
      return dates[0]
    }

    const firstPrescription = [...(patient.pharmacyPrescriptions ?? [])].sort(
      (a, b) => (a.prescribedAt?.toMillis() ?? 0) - (b.prescribedAt?.toMillis() ?? 0)
    )[0]

    return firstPrescription?.prescribedAt ?? null
  }

  private hivPositiveDate(patient: Patient): DateTime | null {
    const dates: DateTime[] = []

    for (const encounter of patient.encounters ?? []) {
      const results = encounter.labRequests?.[0]?.labResults
      if (!results) {
        continue
      }
      for (const result of results) {
        const name = (result.labRequestItem?.testName ?? '').toUpperCase()
        if (!name.includes('HIV') || name.toLowerCase().includes('recency')) {
          continue
        }
        const value = String(result.resultText || result.resultValue || '')
          .toLowerCase()
          .trim()
        if (value !== '' && (value.includes('positive') || value.includes('reactive'))) {
          const at = result.createdAt ?? encounter.startedAt
          if (at) {
            dates.push(at)
          }
        }
      }
    }

    if (dates.length === 0) {
      return null
    }

    return [...dates].sort((a, b) => a.toMillis() - b.toMillis())[0]
  }

  private latestViralLoad(patient: Patient): { result: string; date: string } {
    let latest: { resultText: string | null; resultValue: string | null } | null = null
    let latestAt: DateTime | null = null

    for (const encounter of patient.encounters ?? []) {
      const results = encounter.labRequests?.[0]?.labResults
      if (!results) {
        continue
      }
      for (const result of results) {
        const name = (result.labRequestItem?.testName ?? '').toLowerCase()
        if (!name.includes('viral load')) {
          continue
        }
        const at = result.createdAt ?? encounter.startedAt
        if (latestAt === null || (at && at > latestAt)) {
          latestAt = at
          latest = result
        }
      }
    }

    if (!latest) {
      return { result: '', date: '' }
    }

    return {
      result: String(latest.resultText || latest.resultValue || '').trim(),
      date: latestAt ? fmtNjY(latestAt) : '',
    }
  }

  private startingRegimen(arvItems: PharmacyPrescriptionItem[]): string {
    const first = arvItems[0]
    return first ? this.formatDrugLine(first) : ''
  }

  private startingRegimenDate(arvItems: PharmacyPrescriptionItem[]): DateTime | null {
    return arvItems[0]?.startDate ?? null
  }

  private currentRegimen(arvItems: PharmacyPrescriptionItem[]): string {
    if (arvItems.length === 0) {
      return ''
    }
    return arvItems
      .slice(-3)
      .map((item) => this.formatDrugLine(item))
      .filter((line) => line !== '')
      .join('; ')
  }

  private currentRegimenStartDate(arvItems: PharmacyPrescriptionItem[]): DateTime | null {
    const last = arvItems[arvItems.length - 1]
    return last?.startDate ?? null
  }

  private tptRegimen(arvItems: PharmacyPrescriptionItem[]): string {
    for (const item of arvItems) {
      const name = (item.drugName ?? '').toLowerCase()
      if (name.includes('isoniazid') || name.includes('inh') || name.includes('tpt')) {
        return this.formatDrugLine(item)
      }
    }
    return ''
  }

  private ctxStartDate(arvItems: PharmacyPrescriptionItem[]): DateTime | null {
    for (const item of arvItems) {
      const name = (item.drugName ?? '').toLowerCase()
      if ((name.includes('ctx') || name.includes('cotrim')) && item.startDate) {
        return item.startDate
      }
    }
    return null
  }

  private dispenseQuantity(dispense: PharmacyDispense | null): string {
    if (!dispense) {
      return ''
    }
    let total = 0
    for (const item of dispense.pharmacyDispenseItems ?? []) {
      total += Number(item.quantityDispensed ?? 0)
    }
    return total > 0 ? String(total) : ''
  }

  private isOnTxCurr(dispense: PharmacyDispense | null, reportEnd: DateTime): string {
    if (!dispense?.dispensedAt) {
      return 'NO'
    }
    const days = Math.abs(diffInDays(dispense.dispensedAt, reportEnd))
    return days <= 90 ? 'YES' : 'NO'
  }

  private multiMonthDispensation(dispense: PharmacyDispense | null): string {
    if (!dispense) {
      return ''
    }
    const qty = Number(this.dispenseQuantity(dispense) || 0)
    if (qty >= 180) {
      return '6 MMD'
    }
    if (qty >= 120) {
      return '4 MMD'
    }
    if (qty >= 90) {
      return '3 MMD'
    }
    if (qty > 0) {
      return 'NOT MMD'
    }
    return ''
  }

  private patientStatus(patient: Patient): string {
    return patient.isDeceased ? 'Deceased' : 'Active'
  }

  private eventDate(patient: Patient, encounter: Encounter | null): DateTime | null {
    if (patient.isDeceased && patient.deceasedAt) {
      return patient.deceasedAt
    }
    return encounter?.startedAt ?? null
  }

  private eventDetails(patient: Patient): string {
    if (patient.isDeceased) {
      return String(patient.deceasedNotes ?? 'Deceased').trim()
    }
    return ''
  }

  private breastFeeding(screening: ScreeningRecord | null): string {
    if (!screening) {
      return ''
    }
    if (screening.isBreastFeedingWell === true) {
      return 'Yes'
    }
    if (screening.isBreastFeedingWell === false) {
      return 'No'
    }
    return ''
  }

  private isArvDrug(name: string | null | undefined): boolean {
    if (!filled(name)) {
      return false
    }
    const n = (name as string).toLowerCase()
    const tokens = [
      'arv',
      'antiretroviral',
      'tdf',
      '3tc',
      'dtg',
      'tld',
      'efv',
      'nvp',
      'lpv',
      'atazanavir',
      'lamivudine',
      'tenofovir',
      'dolutegravir',
      'nevirapine',
      'stavudine',
      'abacavir',
      'ftc',
      'taf',
    ]
    return tokens.some((token) => n.includes(token))
  }

  private formatDrugLine(item: PharmacyPrescriptionItem): string {
    return [item.drugName, item.strength, item.formulation]
      .filter((p) => filled(p))
      .join(' ')
      .trim()
  }

  private ageAt(dob: DateTime | null, onDate: DateTime): number | null {
    if (!dob) {
      return null
    }
    return ageInYears(dob, onDate)
  }

  private ageCategory(age: number): string {
    const bandStart = Math.max(0, Math.floor(age / 5) * 5)
    return (
      '.' +
      String(bandStart).padStart(2, '0') +
      '-' +
      String(bandStart + 4).padStart(2, '0')
    )
  }

  private splitName(fullName: string): [string, string] {
    const trimmed = fullName.trim()
    const idx = trimmed.search(/\s+/)
    if (idx === -1) {
      return [trimmed, '']
    }
    const first = trimmed.slice(0, idx)
    const rest = trimmed.slice(idx).replace(/^\s+/, '')
    return [first, rest]
  }

  private formatSex(gender: string | null | undefined): string {
    const g = String(gender ?? '').toLowerCase().trim()
    if (g.startsWith('m') || g === 'male') {
      return 'M'
    }
    if (g.startsWith('f') || g.includes('female')) {
      return 'F'
    }
    return gender ?? ''
  }

  private formatAddress(patient: Patient): string {
    return [
      patient.houseNumber,
      patient.roadStreet,
      patient.area,
      patient.cityTownVillage,
      patient.landmarks,
    ]
      .filter((p) => filled(p))
      .join(', ')
  }

  private formatDecimal(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    return String(value)
  }

  private yesNo(value: boolean | null): string {
    if (value === true) {
      return 'Yes'
    }
    if (value === false) {
      return 'No'
    }
    return ''
  }
}
