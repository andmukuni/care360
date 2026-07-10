import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import { fmtMdY, parseDate, type ReportFilters } from './support.js'

/**
 * Shared OPD register query for preview, export, and row estimates.
 * Ported from App\Support\Reports\OpdRegisterQuery.
 */
export class OpdRegisterQuery {
  static build(filters: ReportFilters) {
    const attendantType = filters.attendant_type ?? null

    const query = Encounter.query()
      .where('visit_type', 'OPD')
      .whereHas('registrationRecords', () => {})

    if (filters.start_date && filters.end_date) {
      const start = parseDate(filters.start_date).startOf('day')
      const end = parseDate(filters.end_date).endOf('day')
      query.whereBetween('started_at', [start.toSQL()!, end.toSQL()!])
    } else {
      const date = filters.date ?? DateTime.now().toFormat('yyyy-MM-dd')
      query.whereRaw('started_at::date = ?', [date])
    }

    if (attendantType === 'first_attendant') {
      query.whereHas('registrationRecords', (q) => q.where('was_existing_patient', false))
    } else if (attendantType === 're_attendant') {
      query.whereHas('registrationRecords', (q) => q.where('was_existing_patient', true))
    }

    return query
  }

  static async count(filters: ReportFilters): Promise<number> {
    const result = await this.build(filters).count('* as total')
    return Number((result[0] as any).$extras.total)
  }

  static periodLabel(filters: ReportFilters): string {
    if (filters.start_date && filters.end_date) {
      return `${fmtMdY(parseDate(filters.start_date))} - ${fmtMdY(parseDate(filters.end_date))}`
    }
    const date = filters.date ?? DateTime.now().toFormat('yyyy-MM-dd')
    return fmtMdY(parseDate(date))
  }
}
