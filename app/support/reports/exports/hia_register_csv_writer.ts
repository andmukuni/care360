import { DateTime } from 'luxon'
import { reportConfig } from '../report_config.js'
import { fmtNjY, parseDate, type CsvSink, type CsvValue, type ReportFilters } from '../support.js'
import { HiaAgeBand } from '../hia/hia_age_band.js'
import { HiaCatalogue, type HiaCatalogueEntry } from '../hia/hia_catalogue.js'
import { HiaReportPayload } from '../hia/hia_report_payload.js'

/**
 * Writes MoH-style HIA 1A / 1B aggregate CSV (UTF-8 BOM applied by caller).
 * Ported from App\Support\Reports\Exports\HiaRegisterCsvWriter.
 */
export class HiaRegisterCsvWriter {
  async write(sink: CsvSink, variant: string, payload: HiaReportPayload, filters: ReportFilters): Promise<number> {
    await this.writeHeaderBlock(sink, variant, filters)
    this.writeColumnHeaderRow(sink, variant)

    const catalogue = HiaCatalogue.entries(variant)
    for (const entry of catalogue) {
      sink.write(this.dataRow(entry, payload))
    }

    return catalogue.length
  }

  private async writeHeaderBlock(sink: CsvSink, variant: string, filters: ReportFilters): Promise<void> {
    const start = filters.start_date ?? DateTime.now().startOf('month').toFormat('yyyy-MM-dd')
    const end = filters.end_date ?? DateTime.now().toFormat('yyyy-MM-dd')
    const startFormatted = fmtNjY(parseDate(start))
    const endFormatted = fmtNjY(parseDate(end))
    const facilityName = await reportConfig.facilityName()

    sink.write(['', HiaCatalogue.title(variant)])
    sink.write(['', 'Province:', reportConfig.province, 'Start Date:', startFormatted])
    sink.write(['', 'District Name:', reportConfig.district, 'End Date:', endFormatted])
    sink.write(['', 'Facility Name:', facilityName])
    sink.write([])
    sink.write([
      '', 'DIAGNOSES', 'OPD First Attendance', '', '', '', '', 'IPD Discharge', '', '', '', '', 'Deaths', '', '', '', '',
    ])
    sink.write([
      '',
      '',
      'under 1 year', '1 to 4 years', '5 to 14 years', '15 and above', 'Total',
      'under 1 year', '1 to 4 years', '5 to 14 years', '15 and above', 'Total',
      'under 1 year', '1 to 4 years', '5 to 14 years', '15 and above', 'Total',
    ])
  }

  private writeColumnHeaderRow(sink: CsvSink, variant: string): void {
    if (variant === 'b' || variant === 'hia_one_b') {
      sink.write([
        '', 'Notifiable Diseases', 'Code',
        '<1Yr', '1-4Yr', '5-14yr', '15+yr', 'Total',
        '<1Yr', '1-4Yr', '5-14yr', '15+yr', 'Total',
        '<1Yr', '1-4Yr', '5-14yr', '15+yr', 'Total',
      ])
      return
    }

    sink.write(['', 'Notifiable Diseases*', 'Code'])
  }

  private dataRow(entry: HiaCatalogueEntry, payload: HiaReportPayload): CsvValue[] {
    const code = entry.code

    return [
      '',
      entry.name,
      code,
      ...this.sectionCounts(payload, code, HiaReportPayload.SECTION_OPD),
      ...this.sectionCounts(payload, code, HiaReportPayload.SECTION_IPD),
      ...this.sectionCounts(payload, code, HiaReportPayload.SECTION_DEATH),
    ]
  }

  private sectionCounts(payload: HiaReportPayload, code: string, section: string): number[] {
    const bands: number[] = []
    let total = 0
    for (const band of HiaAgeBand.bands()) {
      const n = payload.getCount(code, section, band)
      bands.push(n)
      total += n
    }
    bands.push(total)
    return bands
  }
}
