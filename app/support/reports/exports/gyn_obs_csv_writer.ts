import { DateTime } from 'luxon'
import { GynObsReportService } from '#services/gyn_obs/gyn_obs_report_service'
import type { CsvSink } from '../support.js'

/**
 * Writes Gyn & OBS report sections to a CSV sink (UTF-8 BOM applied by caller).
 * Ported from App\Support\Reports\Exports\GynObsCsvWriter.
 */
export class GynObsCsvWriter {
  constructor(private readonly reportService: GynObsReportService = new GynObsReportService()) {}

  async write(sink: CsvSink, start: DateTime, end: DateTime): Promise<number> {
    const payload = await this.reportService.buildReportPayload(start, end)
    let rows = 0

    sink.write(['Period: ' + payload.period])
    sink.write([])
    rows += 2

    sink.write(['CERVICAL SCREENING SUMMARY'])
    sink.write(['Metric', 'Count'])
    for (const [key, value] of Object.entries(payload.cervicalSummary)) {
      sink.write([this.label(key), value])
      rows++
    }
    sink.write([])
    rows++

    sink.write(['CERVICAL OUTCOMES BY MONTH'])
    sink.write(['Month', ...payload.allCervicalResults])
    for (const [month, results] of Object.entries(payload.cervicalMonthPivot)) {
      const line: (string | number)[] = [month]
      for (const result of payload.allCervicalResults) {
        line.push(results[result] ?? 0)
      }
      sink.write(line)
      rows++
    }
    sink.write([])
    rows++

    sink.write(['CONTRACEPTIVE SUMMARY'])
    sink.write(['Metric', 'Count'])
    for (const [key, value] of Object.entries(payload.contraceptiveSummary)) {
      sink.write([this.label(key), value])
      rows++
    }
    sink.write([])
    sink.write(['CONTRACEPTIVE METHOD', 'Count'])
    for (const row of payload.contraceptiveDistribution) {
      sink.write([row.method, row.total])
      rows++
    }
    sink.write([])
    rows++

    sink.write(['ANTENATAL SUMMARY'])
    sink.write(['Metric', 'Value'])
    for (const [key, value] of Object.entries(payload.antenatalSummary)) {
      sink.write([this.label(key), value ?? '—'])
      rows++
    }
    sink.write([])
    sink.write(['Patient', 'Ref', 'Gravida', 'Para', 'EDD', 'LMP'])
    for (const row of payload.upcomingDeliveries) {
      sink.write([
        row.full_name,
        row.patient_ref,
        row.gravida,
        row.para,
        row.expected_delivery_date,
        row.last_menstrual_period,
      ])
      rows++
    }

    return rows
  }

  /** Mirrors PHP `str_replace('_', ' ', ucfirst($key))`. */
  private label(key: string): string {
    const ucfirst = key.charAt(0).toUpperCase() + key.slice(1)
    return ucfirst.replace(/_/g, ' ')
  }
}
