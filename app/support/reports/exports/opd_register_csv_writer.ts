import { DateTime } from 'luxon'
import type Encounter from '#models/encounter'
import { OpdRegisterColumns } from '../opd_register_columns.js'
import { OpdRegisterQuery } from '../opd_register_query.js'
import { OpdRegisterRowMapper } from '../opd_register_row_mapper.js'
import { reportConfig } from '../report_config.js'
import { chunkQuery, fmtNjY, parseDate, type CsvSink, type ReportFilters } from '../support.js'

/**
 * Writes MoH-style OPD register CSV (UTF-8 BOM applied by caller).
 * Ported from App\Support\Reports\Exports\OpdRegisterCsvWriter.
 */
export class OpdRegisterCsvWriter {
  constructor(private readonly rowMapper: OpdRegisterRowMapper = new OpdRegisterRowMapper()) {}

  async write(
    sink: CsvSink,
    filters: ReportFilters,
    onProgress?: (processed: number) => void
  ): Promise<number> {
    await this.writeHeaderBlock(sink, filters)
    sink.write(OpdRegisterColumns.headers())

    let processed = 0

    const query = OpdRegisterQuery.build(filters)
      .preload('patient')
      .preload('screeningRecords')
      .preload('labRequests', (lr) =>
        lr.preload('labRequestItems').preload('labResults', (r) => r.preload('labRequestItem'))
      )
      .orderBy('started_at')

    await chunkQuery<Encounter>(query, 500, (encounters) => {
      for (const encounter of encounters) {
        sink.write(this.rowMapper.toRow(encounter))
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

    sink.write(['OPD Register', ...Array(14).fill('')])
    sink.write(['', 'Facility:', facilityName, 'Date:', `${startFormatted} to ${endFormatted}`])
    sink.write(['', 'District:', reportConfig.district])
    sink.write(['', 'Province:', reportConfig.province])
    sink.write([])
  }
}
