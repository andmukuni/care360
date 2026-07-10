import { DateTime } from 'luxon'
import type ScreeningRecord from '#models/screening_record'
import { AncRegisterColumns } from '../anc_register_columns.js'
import { AncRegisterQuery } from '../anc_register_query.js'
import { AncRegisterRowMapper } from '../anc_register_row_mapper.js'
import { reportConfig } from '../report_config.js'
import {
  chunkQuery,
  clinicianNameMap,
  fmtNjY,
  parseDate,
  type CsvSink,
  type ReportFilters,
} from '../support.js'

/**
 * Writes MoH-style ANC register CSV (UTF-8 BOM applied by caller).
 * Ported from App\Support\Reports\Exports\AncRegisterCsvWriter.
 */
export class AncRegisterCsvWriter {
  constructor(private readonly rowMapper: AncRegisterRowMapper = new AncRegisterRowMapper()) {}

  async write(
    sink: CsvSink,
    filters: ReportFilters,
    onProgress?: (processed: number) => void
  ): Promise<number> {
    await this.writeHeaderBlock(sink, filters)
    sink.write(AncRegisterColumns.headers())

    let processed = 0
    const contactCounts: Record<number, number> = {}

    const query = AncRegisterQuery.build(filters)
      .preload('patient')
      .preload('encounter', (e) =>
        e
          .preload('triageRecords')
          .preload('labRequests', (lr) =>
            lr.preload('labRequestItems').preload('labResults', (r) => r.preload('labRequestItem'))
          )
      )

    await chunkQuery<ScreeningRecord>(query, 500, async (records) => {
      const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
      for (const record of records) {
        const patientId = record.patientId
        contactCounts[patientId] = (contactCounts[patientId] ?? 0) + 1
        sink.write(
          this.rowMapper.toRow(
            record,
            contactCounts[patientId],
            clinicians.get(record.clinicianId) ?? ''
          )
        )
        processed++
      }
      onProgress?.(processed)
    })

    return processed
  }

  private async writeHeaderBlock(sink: CsvSink, filters: ReportFilters): Promise<void> {
    const start = filters.start_date ?? DateTime.now().startOf('month').toFormat('yyyy-MM-dd')
    const end = filters.end_date ?? DateTime.now().toFormat('yyyy-MM-dd')
    const startFormatted = fmtNjY(parseDate(start))
    const endFormatted = fmtNjY(parseDate(end))
    const facilityName = await reportConfig.facilityName()

    sink.write(['Antenatal Care Register', ...Array(14).fill('')])
    sink.write(['', 'Province:', reportConfig.province, 'Start Date:', startFormatted])
    sink.write(['', 'District Name:', reportConfig.district, 'End Date:', endFormatted])
    sink.write(['', 'Facility Name:', facilityName])
    sink.write([])
  }
}
