import ScreeningRecord from '#models/screening_record'
import { fmtMdY, parseDate, type ReportFilters } from './support.js'

/**
 * Postnatal Care register — female patient screening visits in the selected period.
 * Ported from App\Support\Reports\PncRegisterQuery.
 */
export class PncRegisterQuery {
  static build(filters: ReportFilters = {}) {
    const query = ScreeningRecord.query().whereHas('patient', (q) => {
      q.where((gender) => {
        gender
          .whereRaw('LOWER(TRIM(gender)) IN (?, ?)', ['female', 'f'])
          .orWhereRaw('LOWER(TRIM(gender)) LIKE ?', ['%female%'])
      })
    })

    if (filters.start_date && filters.end_date) {
      const start = parseDate(filters.start_date).startOf('day')
      const end = parseDate(filters.end_date).endOf('day')
      query.whereRaw('COALESCE(screening_started_at, created_at) BETWEEN ? AND ?', [
        start.toSQL()!,
        end.toSQL()!,
      ])
    }

    return query
      .orderBy('patient_id')
      .orderByRaw('COALESCE(screening_started_at, created_at)')
      .orderBy('id')
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
