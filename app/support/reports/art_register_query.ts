import Patient from '#models/patient'
import { fmtMdY, parseDate, type ReportFilters } from './support.js'

/**
 * ART register — one row per patient with an ART number and activity in the reporting period.
 * Ported from App\Support\Reports\ArtRegisterQuery.
 */
export class ArtRegisterQuery {
  static build(filters: ReportFilters = {}) {
    const query = Patient.query().whereNotNull('art_number').where('art_number', '!=', '')

    if (filters.start_date && filters.end_date) {
      const start = parseDate(filters.start_date).startOf('day')
      const end = parseDate(filters.end_date).endOf('day')

      query.where((q) => {
        q.whereHas('encounters', (encounter) => {
          encounter.whereBetween('started_at', [start.toSQL()!, end.toSQL()!])
        })
          .orWhereHas('pharmacyDispenses', (dispense) => {
            dispense.whereBetween('dispensed_at', [start.toSQL()!, end.toSQL()!])
          })
          .orWhere((death) => {
            death
              .where('is_deceased', true)
              .whereNotNull('deceased_at')
              .whereBetween('deceased_at', [start.toFormat('yyyy-MM-dd'), end.toFormat('yyyy-MM-dd')])
          })
      })
    }

    return query.orderBy('art_number').orderBy('id')
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

  /**
   * Apply the eager loads needed by ArtRegisterRowMapper. Equivalent to the
   * Laravel `eagerLoads()` array fed to `->with(...)`.
   */
  static applyEagerLoads(query: ReturnType<typeof ArtRegisterQuery.build>, filters: ReportFilters = {}) {
    const start = filters.start_date ? parseDate(filters.start_date).startOf('day') : null
    const end = filters.end_date ? parseDate(filters.end_date).endOf('day') : null

    query.preload('encounters', (q) => {
      if (start && end) {
        q.whereBetween('started_at', [start.toSQL()!, end.toSQL()!])
      }
      q.preload('screeningRecords')
        .preload('triageRecords')
        .preload('labRequests', (lr) =>
          lr.preload('labResults', (res) => res.preload('labRequestItem'))
        )
        .preload('pharmacyPrescriptions', (p) => p.preload('pharmacyPrescriptionItems'))
        .preload('pharmacyDispenses', (d) => d.preload('pharmacyDispenseItems'))
        .orderBy('started_at', 'desc')
    })

    query.preload('pharmacyDispenses', (q) => {
      if (start && end) {
        q.whereBetween('dispensed_at', [start.toSQL()!, end.toSQL()!])
      }
      q.preload('pharmacyDispenseItems')
        .preload('pharmacyPrescription', (p) => p.preload('pharmacyPrescriptionItems'))
        .orderBy('dispensed_at', 'desc')
    })

    query.preload('pharmacyPrescriptions', (q) =>
      q.preload('pharmacyPrescriptionItems').orderBy('prescribed_at')
    )

    return query
  }
}
