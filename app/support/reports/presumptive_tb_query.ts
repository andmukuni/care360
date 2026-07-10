import ScreeningRecord from '#models/screening_record'
import { fmtMdY, parseDate, type ReportFilters } from './support.js'

/**
 * Shared presumptive TB register query for preview, export, and row estimates.
 * Ported from App\Support\Reports\PresumptiveTbQuery.
 */
export class PresumptiveTbQuery {
  static build(filters: ReportFilters = {}) {
    const query = ScreeningRecord.query().whereNotNull('presumptive_tb_case_no')

    if (filters.start_date && filters.end_date) {
      const start = parseDate(filters.start_date).startOf('day')
      const end = parseDate(filters.end_date).endOf('day')
      query.whereBetween('screening_started_at', [start.toSQL()!, end.toSQL()!])
    }

    return query.orderBy('screening_started_at', 'desc').orderBy('id', 'desc')
  }

  static async count(filters: ReportFilters = {}): Promise<number> {
    const result = await this.build(filters).count('* as total')
    return Number((result[0] as any).$extras.total)
  }

  static periodLabel(filters: ReportFilters): string {
    if (filters.start_date && filters.end_date) {
      return `${fmtMdY(parseDate(filters.start_date))} - ${fmtMdY(parseDate(filters.end_date))}`
    }
    return 'All records'
  }
}
