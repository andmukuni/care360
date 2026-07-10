import { DateTime } from 'luxon'
import type Patient from '#models/patient'
import { ArtRegisterColumns } from '../art_register_columns.js'
import { ArtRegisterQuery } from '../art_register_query.js'
import { ArtRegisterRowMapper } from '../art_register_row_mapper.js'
import { reportConfig } from '../report_config.js'
import { chunkQuery, fmtDmY, parseDate, type CsvSink, type ReportFilters } from '../support.js'

/**
 * Writes MoH-style ART register CSV (UTF-8 BOM applied by caller).
 * Ported from App\Support\Reports\Exports\ArtRegisterCsvWriter.
 */
export class ArtRegisterCsvWriter {
  constructor(private readonly rowMapper: ArtRegisterRowMapper = new ArtRegisterRowMapper()) {}

  async write(
    sink: CsvSink,
    filters: ReportFilters,
    onProgress?: (processed: number) => void
  ): Promise<number> {
    await this.writeHeaderBlock(sink, filters)
    sink.write(ArtRegisterColumns.headers())

    const reportEnd = parseDate(filters.end_date ?? DateTime.now().toISODate()!).endOf('day')
    let processed = 0

    const query = ArtRegisterQuery.applyEagerLoads(ArtRegisterQuery.build(filters), filters)

    await chunkQuery<Patient>(query, 500, (patients) => {
      for (const patient of patients) {
        sink.write(this.rowMapper.toRow(patient, reportEnd))
        processed++
      }
      onProgress?.(processed)
    })

    return processed
  }

  private async writeHeaderBlock(sink: CsvSink, filters: ReportFilters): Promise<void> {
    const start = filters.start_date ?? DateTime.now().startOf('month').toFormat('yyyy-MM-dd')
    const end = filters.end_date ?? DateTime.now().toFormat('yyyy-MM-dd')
    const startFormatted = fmtDmY(parseDate(start))
    const endFormatted = fmtDmY(parseDate(end))
    const facilityName = await reportConfig.facilityName()

    sink.write(['ART Register v1.3', ...Array(20).fill('')])
    sink.write(['', 'Facility:', facilityName, 'Date:', endFormatted])
    sink.write(['', 'District:', reportConfig.district])
    sink.write(['', 'Province:', reportConfig.province])
    sink.write(['', 'Period:', `${startFormatted} to ${endFormatted}`])
    sink.write([])
  }
}
