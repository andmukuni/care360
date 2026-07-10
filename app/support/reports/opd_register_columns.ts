/**
 * MoH OPD Register column headers (row 8 of OPD_Register_ReportMay26.xlsx).
 * Ported from App\Support\Reports\OpdRegisterColumns.
 */
export class OpdRegisterColumns {
  static headers(): string[] {
    return [
      'NUPN',
      'NHIMA No',
      'Encounter Date',
      'FirstName',
      'Surname',
      'Age',
      'Sex',
      'Phone No',
      'Address',
      'Screened with HIV Screening Tool',
      'Test Modality',
      'HIV Tested',
      'HIV Test Result',
      'Reffered for ART',
      'Recency Test Done',
      'TB Status',
      'Diagnosis',
      'ICD11 Code',
      'Treatment Given',
      'Referred to',
      'Remarks',
    ]
  }

  static columnIndex(header: string): number {
    return this.headers().indexOf(header)
  }
}
