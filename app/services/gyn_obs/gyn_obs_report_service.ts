import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { DatabaseQueryBuilderContract } from '@adonisjs/lucid/types/querybuilder'

export interface GynObsUpcomingDelivery {
  full_name: string
  patient_ref: string
  gravida: number | null
  para: number | null
  expected_delivery_date: string | null
  last_menstrual_period: string | null
  encounter_id: number | null
}

export interface GynObsContraceptiveRow {
  method: string | null
  total: number
}

export interface GynObsReportPayload {
  title: string
  period: string
  start_date: string
  end_date: string
  cervicalSummary: Record<string, number>
  cervicalMonthPivot: Record<string, Record<string, number>>
  allCervicalResults: string[]
  contraceptiveSummary: Record<string, number>
  contraceptiveDistribution: GynObsContraceptiveRow[]
  antenatalSummary: Record<string, number | null>
  upcomingDeliveries: GynObsUpcomingDelivery[]
  gravidaParaTrend: any[]
}

/**
 * GynObsReportService
 * ─────────────────────────────────────────────────────────────────────────
 * All read-only aggregate queries for the Gyn & OBS reporting dashboard.
 * Ported from App\Services\GynObs\GynObsReportService.
 *
 * The live database is PostgreSQL, so the SQL fragments target Postgres. The
 * original Laravel service branched on the driver; that switch is preserved in
 * spirit but reduced to the Postgres form here.
 */
export class GynObsReportService {
  protected monthBucketExpr(column: string): string {
    return `TO_CHAR(${column}, 'YYYY-MM')`
  }

  protected numericCastExpr(column: string): string {
    return `CAST(${column} AS NUMERIC)`
  }

  async recordsInPeriodCount(start: DateTime, end: DateTime): Promise<number> {
    const result = await db
      .from('screening_records')
      .whereBetween('created_at', [
        start.startOf('day').toSQL()!,
        end.endOf('day').toSQL()!,
      ])
      .count('* as total')
    return Number((result[0] as any).total)
  }

  async buildReportPayload(start: DateTime, end: DateTime): Promise<GynObsReportPayload> {
    const cervicalByMonth = await this.cervicalOutcomesByMonth(start, end)
    const cervicalMonthPivot: Record<string, Record<string, number>> = {}
    for (const row of cervicalByMonth) {
      const month = String(row.month)
      cervicalMonthPivot[month] ??= {}
      cervicalMonthPivot[month][String(row.result)] = Number(row.total)
    }
    const orderedPivot: Record<string, Record<string, number>> = {}
    for (const month of Object.keys(cervicalMonthPivot).sort()) {
      orderedPivot[month] = cervicalMonthPivot[month]
    }

    return {
      title: 'Gyn & OBS Dashboard',
      period: `${start.toFormat('LLL dd, yyyy')} - ${end.toFormat('LLL dd, yyyy')}`,
      start_date: start.toFormat('yyyy-MM-dd'),
      end_date: end.toFormat('yyyy-MM-dd'),
      cervicalSummary: await this.cervicalScreeningSummary(start, end),
      cervicalMonthPivot: orderedPivot,
      allCervicalResults: [
        'normal',
        'abnormal_low_grade',
        'abnormal_high_grade',
        'suspicious_cancer',
        'inconclusive',
      ],
      contraceptiveSummary: await this.contraceptiveSummary(start, end),
      contraceptiveDistribution: await this.contraceptiveMethodDistribution(start, end),
      antenatalSummary: await this.antenatalSummary(start, end),
      upcomingDeliveries: await this.upcomingDeliveries(20, start, end),
      gravidaParaTrend: await this.gravidaParaTrend(start, end),
    }
  }

  async cervicalOutcomesByMonth(
    start: DateTime | null = null,
    end: DateTime | null = null,
    months = 12
  ): Promise<any[]> {
    const monthExpr = this.monthBucketExpr('cervical_screening_date')

    const query = db
      .from('screening_records')
      .select(
        db.raw(`${monthExpr} AS month`),
        db.raw('cervical_screening_result AS result'),
        db.raw('COUNT(*) AS total')
      )
      .where('cervical_screening_done', true)
      .whereNotNull('cervical_screening_date')
      .whereNotNull('cervical_screening_result')

    if (start && end) {
      query.whereBetween('cervical_screening_date', [
        start.toFormat('yyyy-MM-dd'),
        end.toFormat('yyyy-MM-dd'),
      ])
    } else {
      const since = DateTime.now().startOf('month').minus({ months: months - 1 })
      query.where('cervical_screening_date', '>=', since.toFormat('yyyy-MM-dd'))
    }

    return query.groupByRaw('month, result').orderBy('month')
  }

  async cervicalScreeningSummary(
    start: DateTime | null = null,
    end: DateTime | null = null
  ): Promise<Record<string, number>> {
    const screened = db.from('screening_records').where('cervical_screening_done', true)
    const never = db.from('screening_records').where('cervical_screening_done', false)
    const suspicious = db
      .from('screening_records')
      .where('cervical_screening_result', 'suspicious_cancer')
    const highGrade = db
      .from('screening_records')
      .where('cervical_screening_result', 'abnormal_high_grade')

    for (const query of [screened, never, suspicious, highGrade]) {
      this.applyCervicalDateScope(query, start, end)
    }

    return {
      total_screened: await this.countOf(screened),
      total_never: await this.countOf(never),
      total_suspicious: await this.countOf(suspicious),
      total_high_grade: await this.countOf(highGrade),
    }
  }

  async contraceptiveMethodDistribution(
    start: DateTime | null = null,
    end: DateTime | null = null
  ): Promise<GynObsContraceptiveRow[]> {
    const query = db
      .from('screening_records')
      .select(db.raw('contraceptive_method AS method'), db.raw('COUNT(*) AS total'))
      .where('using_contraception', true)
      .whereNotNull('contraceptive_method')

    this.applyCreatedAtScope(query, start, end)

    const rows = await query.groupBy('contraceptive_method').orderBy('total', 'desc')
    return rows.map((row: any) => ({ method: row.method, total: Number(row.total) }))
  }

  async contraceptiveSummary(
    start: DateTime | null = null,
    end: DateTime | null = null
  ): Promise<Record<string, number>> {
    const using = db.from('screening_records').where('using_contraception', true)
    const notUsing = db.from('screening_records').where('using_contraception', false)
    this.applyCreatedAtScope(using, start, end)
    this.applyCreatedAtScope(notUsing, start, end)

    return {
      using_contraception: await this.countOf(using),
      not_using: await this.countOf(notUsing),
    }
  }

  async antenatalSummary(
    start: DateTime | null = null,
    end: DateTime | null = null
  ): Promise<Record<string, number | null>> {
    const pregnant = db.from('screening_records').where('currently_pregnant', true)
    const withHistory = db.from('screening_records').whereNotNull('gravida')
    const gravidaAvg = db.from('screening_records').whereNotNull('gravida')
    const paraAvg = db.from('screening_records').whereNotNull('para')

    for (const query of [pregnant, withHistory, gravidaAvg, paraAvg]) {
      this.applyCreatedAtScope(query, start, end)
    }

    const eddQuery = db.from('screening_records').where('currently_pregnant', true)
    if (start && end) {
      eddQuery.whereBetween('expected_delivery_date', [
        start.toFormat('yyyy-MM-dd'),
        end.toFormat('yyyy-MM-dd'),
      ])
      this.applyCreatedAtScope(eddQuery, start, end)
    } else {
      const monthStart = DateTime.now().startOf('month').toFormat('yyyy-MM-dd')
      const monthEnd = DateTime.now().endOf('month').toFormat('yyyy-MM-dd')
      eddQuery.whereBetween('expected_delivery_date', [monthStart, monthEnd])
    }

    const avgGravidaRow = await gravidaAvg.avg('gravida as aggregate')
    const avgParaRow = await paraAvg.avg('para as aggregate')
    const avgGravida = (avgGravidaRow[0] as any).aggregate
    const avgPara = (avgParaRow[0] as any).aggregate

    return {
      currently_pregnant: await this.countOf(pregnant),
      edd_this_month: await this.countOf(eddQuery),
      avg_gravida: avgGravida !== null ? Math.round(Number(avgGravida) * 10) / 10 : null,
      avg_para: avgPara !== null ? Math.round(Number(avgPara) * 10) / 10 : null,
      total_with_obs_history: await this.countOf(withHistory),
    }
  }

  async upcomingDeliveries(
    limit = 20,
    start: DateTime | null = null,
    end: DateTime | null = null
  ): Promise<GynObsUpcomingDelivery[]> {
    const query = db
      .from('screening_records as sr')
      .join('patients as p', 'p.id', '=', 'sr.patient_id')
      .select(
        'p.full_name',
        'p.patient_id as patient_ref',
        'sr.gravida',
        'sr.para',
        'sr.expected_delivery_date',
        'sr.last_menstrual_period',
        'sr.encounter_id'
      )
      .where('sr.currently_pregnant', true)
      .whereNotNull('sr.expected_delivery_date')

    if (start && end) {
      query.whereBetween('sr.expected_delivery_date', [
        start.toFormat('yyyy-MM-dd'),
        end.toFormat('yyyy-MM-dd'),
      ])
    } else {
      query.where('sr.expected_delivery_date', '>=', DateTime.now().toFormat('yyyy-MM-dd'))
    }

    const rows = await query.orderBy('sr.expected_delivery_date').limit(Math.min(limit, 50))
    return rows.map((row: any) => ({
      full_name: row.full_name,
      patient_ref: row.patient_ref,
      gravida: row.gravida,
      para: row.para,
      expected_delivery_date: this.asDateString(row.expected_delivery_date),
      last_menstrual_period: this.asDateString(row.last_menstrual_period),
      encounter_id: row.encounter_id,
    }))
  }

  async gravidaParaTrend(
    start: DateTime | null = null,
    end: DateTime | null = null,
    months = 12
  ): Promise<any[]> {
    const monthExpr = this.monthBucketExpr('created_at')
    const gravidaExpr = this.numericCastExpr('gravida')
    const paraExpr = this.numericCastExpr('para')

    const query = db
      .from('screening_records')
      .select(
        db.raw(`${monthExpr} AS month`),
        db.raw(`ROUND(AVG(${gravidaExpr}), 1) AS avg_gravida`),
        db.raw(`ROUND(AVG(${paraExpr}), 1) AS avg_para`),
        db.raw('COUNT(*) AS total_records')
      )
      .whereNotNull('gravida')

    if (start && end) {
      query.whereBetween('created_at', [
        start.startOf('day').toSQL()!,
        end.endOf('day').toSQL()!,
      ])
    } else {
      const since = DateTime.now().startOf('month').minus({ months: months - 1 })
      query.where('created_at', '>=', since.toFormat('yyyy-MM-dd'))
    }

    return query.groupByRaw('month').orderBy('month')
  }

  protected applyCreatedAtScope(
    query: DatabaseQueryBuilderContract,
    start: DateTime | null,
    end: DateTime | null
  ): DatabaseQueryBuilderContract {
    if (start && end) {
      query.whereBetween('created_at', [
        start.startOf('day').toSQL()!,
        end.endOf('day').toSQL()!,
      ])
    }
    return query
  }

  protected applyCervicalDateScope(
    query: DatabaseQueryBuilderContract,
    start: DateTime | null,
    end: DateTime | null
  ): DatabaseQueryBuilderContract {
    if (start && end) {
      query.whereBetween('cervical_screening_date', [
        start.toFormat('yyyy-MM-dd'),
        end.toFormat('yyyy-MM-dd'),
      ])
    }
    return query
  }

  private async countOf(query: DatabaseQueryBuilderContract): Promise<number> {
    const result = await query.count('* as total')
    return Number((result[0] as any).total)
  }

  private asDateString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null
    }
    if (value instanceof Date) {
      return DateTime.fromJSDate(value).toFormat('yyyy-MM-dd')
    }
    return String(value)
  }
}
