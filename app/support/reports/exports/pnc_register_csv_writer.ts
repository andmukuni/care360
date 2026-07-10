import { DateTime } from 'luxon'
import type ScreeningRecord from '#models/screening_record'
import { PncRegisterColumns } from '../pnc_register_columns.js'
import { PncRegisterQuery } from '../pnc_register_query.js'
import { PncRegisterRowMapper } from '../pnc_register_row_mapper.js'
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
 * Writes MoH-style PNC register CSV (UTF-8 BOM applied by caller).
 * Ported from App\Support\Reports\Exports\PncRegisterCsvWriter.
 */
export class PncRegisterCsvWriter {
  constructor(private readonly rowMapper: PncRegisterRowMapper = new PncRegisterRowMapper()) {}

  async write(
    sink: CsvSink,
    filters: ReportFilters,
    onProgress?: (processed: number) => void
  ): Promise<number> {
    await this.writeHeaderBlock(sink, filters)
    sink.write(PncRegisterColumns.headers())

    let processed = 0
    const visitCounts: Record<number, number> = {}

    const query = PncRegisterQuery.build(filters).preload('patient').preload('encounter')

    await chunkQuery<ScreeningRecord>(query, 500, async (records) => {
      const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
      for (const record of records) {
        const patientId = record.patientId
        visitCounts[patientId] = (visitCounts[patientId] ?? 0) + 1
        sink.write(
          this.rowMapper.toRow(
            record,
            visitCounts[patientId],
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

    sink.write(['PNC Register', ...Array(14).fill('')])
    sink.write(['', 'Province:', reportConfig.province, 'Start Date:', startFormatted])
    sink.write(['', 'District Name:', reportConfig.district, 'End Date:', endFormatted])
    sink.write(['', 'Facility Name:', facilityName])
    sink.write([])
  }
}
