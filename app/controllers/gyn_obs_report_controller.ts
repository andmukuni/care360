import type { HttpContext } from '@adonisjs/core/http'
import { GynObsReportService } from '#services/gyn_obs/gyn_obs_report_service'

const ALL_CERVICAL_RESULTS = [
  'normal',
  'abnormal_low_grade',
  'abnormal_high_grade',
  'suspicious_cancer',
  'inconclusive',
]

/**
 * Gyn & OBS reporting dashboard (read-only).
 * Ported from App\Http\Controllers\GynObsReportController — wired to the shared
 * GynObsReportService.
 */
export default class GynObsReportController {
  private readonly reportService = new GynObsReportService()

  async index({ inertia }: HttpContext) {
    const cervicalSummary = await this.reportService.cervicalScreeningSummary()
    const cervicalByMonth = await this.reportService.cervicalOutcomesByMonth(null, null, 12)

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

    const contraceptiveSummary = await this.reportService.contraceptiveSummary()
    const contraceptiveDistribution = await this.reportService.contraceptiveMethodDistribution()

    const antenatalSummary = await this.reportService.antenatalSummary()
    const upcomingDeliveries = await this.reportService.upcomingDeliveries(20)
    const gravidaParaTrend = await this.reportService.gravidaParaTrend(null, null, 12)

    return inertia.render('reports/gyn-obs/index', {
      cervicalSummary,
      cervicalMonthPivot: orderedPivot,
      allCervicalResults: ALL_CERVICAL_RESULTS,
      contraceptiveSummary,
      contraceptiveDistribution,
      antenatalSummary,
      upcomingDeliveries,
      gravidaParaTrend,
    })
  }
}
