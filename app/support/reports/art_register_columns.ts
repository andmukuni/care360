/**
 * MoH ART Register column headers (row 8 of ART_Register_ReportMay26.xlsx).
 * Ported from App\Support\Reports\ArtRegisterColumns.
 */
export class ArtRegisterColumns {
  static headers(): string[] {
    return [
      'NUPN',
      'ART No',
      'Date of Birth',
      'Age',
      'Age Category',
      'First Name',
      'Surname',
      'Sex',
      'Mobile',
      'Address',
      'Date Tested Positive',
      'ART Start Date',
      'Treatment Duration In Months',
      'Pregnant',
      'BreastFeeding',
      'Date Due for Cancer Screening',
      'TPT Initial Regime',
      'TPT Initial Prophlaxis Start Date',
      'TPT Prophylaxis Completion Date',
      'TPT Units Dispensed',
      'Eligible for TPT(3years)',
      'CTX Start Date',
      'Starting Regimen',
      'Date of Starting Regimen',
      'Last weight recorded',
      'Current Regimen',
      'Current Regimen Start Date',
      'Date of Current ARV Dispensation',
      'Most Recent ARV Dispensing Quantity',
      'Is on TxCURR',
      'Next Pharmacy Visit',
      'Days Late',
      'MultiMonth Dispensation',
      'Date Enrolled in DSD',
      'Current DSD model',
      'Most Recent Viral Load Result',
      'Most Recent Viral Load Date',
      'Next Viral Load Date',
      'Patient Status',
      'Event Date',
      'Event Details',
      'Is Client Disabled',
      'Type Of Disability',
      'Other Disability',
    ]
  }

  static columnIndex(header: string): number {
    return this.headers().indexOf(header)
  }
}
