/**
 * MoH Antenatal Care Register column headers (row 8 of ANC_Register_ReportMay26.xlsx).
 * Ported from App\Support\Reports\AncRegisterColumns.
 */
export class AncRegisterColumns {
  static headers(): string[] {
    return [
      'Client Name',
      'SM Number',
      'Age',
      'Marital Status',
      'Phone',
      'Address',
      'Origin Code',
      'Gravida',
      'Parity',
      'Date of LMP',
      'EDD',
      'TT Previous doses',
      'Known HIV+',
      'Already on ART at 1st visit',
      'Contact Count Number',
      'Date of this Visit',
      'Gestation (weeks)',
      'Blood Pressure',
      'Weight',
      'Haemoglobin',
      'Urine Protein',
      'Glucose',
      'Deworming',
      'Current TT Doses',
      'Folate',
      'Iron',
      'Syphilis Test',
      'B Penicillin',
      'Other Treatment',
      'Hepatitis B Screening',
      'Hepatitis B Treatment',
      'IPT Given',
      'ITN issued',
      'Initial HIV Test',
      'Sub-sequent HIV Tests',
      'Recency Test',
      'Initiated on CTX ',
      'Start ART in ANC',
      'ART Number',
      'Codes for reasons if woman is HIV+ but not on ART',
      'PrEP',
      'Viral Load Result',
      'Came as a Couple',
      'Partner Tested',
      "Partner's Test Result",
      'Discondant',
      'Recency Test',
      'Partner started ART in ANC',
      'Partner Syphilis Test',
      'Partner Hep B Screening',
      'Partner started on PrEP',
      'Breast Cancer screening',
      'Suspected Breast Cancer',
      'TB',
      'INH Prophylaxis',
      'Previous or Present Conditions Requiring Special Attention',
      'Name of Service Provider',
      'Title/Rank of service Provider',
      'Remarks',
    ]
  }

  static columnIndex(header: string): number {
    return this.headers().indexOf(header)
  }
}
