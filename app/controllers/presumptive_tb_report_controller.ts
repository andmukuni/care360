import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ScreeningRecord from '#models/screening_record'
import { clinicianNameMap, fmtYmdHi } from '#support/reports/support'

/**
 * Presumptive TB reporting dashboard.
 * Ported from App\Http\Controllers\PresumptiveTbReportController.
 *
 * NOTE: the Laravel `ScreeningRecord` exposed a `clinician` relation; the Adonis
 * model has none, so clinician display names are resolved via the shared
 * `clinicianNameMap` helper (same approach the register CSV writers use).
 */
export default class PresumptiveTbReportController {
  async index({ request, inertia }: HttpContext) {
    const page = Number(request.qs().page ?? 1) || 1
    const perPage = 50

    const paginator = await ScreeningRecord.query()
      .whereNotNull('presumptive_tb_case_no')
      .preload('patient')
      .preload('encounter')
      .orderBy('screening_started_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    const clinicians = await clinicianNameMap(paginator.all().map((r) => r.clinicianId))

    const records = paginator.all().map((r) => ({
      id: r.id,
      case_no: r.presumptiveTbCaseNo,
      screened_at: r.screeningStartedAt ? fmtYmdHi(r.screeningStartedAt) : null,
      patient: r.patient?.fullName ?? null,
      encounter: r.encounter?.encounterNumber ?? null,
      constitutional_symptoms: r.constitutionalSymptoms || null,
      clinician: clinicians.get(r.clinicianId) ?? null,
    }))

    const now = DateTime.now()
    const summary = {
      total: await this.countCases((q) => q),
      today: await this.countCases((q) => q.whereRaw('DATE(screening_started_at) = ?', [now.toISODate()])),
      this_month: await this.countCases((q) =>
        q.whereRaw('EXTRACT(MONTH FROM screening_started_at) = ?', [now.month]).whereRaw(
          'EXTRACT(YEAR FROM screening_started_at) = ?',
          [now.year]
        )
      ),
    }

    return inertia.render('reports/presumptive-tb/index', {
      records,
      meta: {
        current_page: paginator.currentPage,
        last_page: paginator.lastPage,
        total: paginator.total,
        per_page: paginator.perPage,
      },
      summary,
    })
  }

  private async countCases(
    scope: (query: ReturnType<typeof ScreeningRecord.query>) => ReturnType<typeof ScreeningRecord.query>
  ): Promise<number> {
    const query = ScreeningRecord.query().whereNotNull('presumptive_tb_case_no')
    const result = await scope(query).count('* as total')
    return Number((result[0] as any).$extras.total)
  }
}
