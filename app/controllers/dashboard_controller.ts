import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'
import DashboardInsightFlashes from '#support/dashboard_insight_flashes'
import { resolveRoleNav } from '#support/staff/role_nav_profiles'

/**
 * Staff dashboard. Ported from App\Http\Controllers\AuthController::dashboard.
 *
 * Focused clinical roles redirect to their profile landing path; everyone else
 * gets the KPI/encounter-cycle dashboard payload.
 */
export default class DashboardController {
  async index(ctx: HttpContext) {
    const { auth, response, inertia } = ctx
    const user = auth.use('web').user ?? null
    const roleNames = user ? await user.getRoleNames() : []
    const roleNav = resolveRoleNav(roleNames)

    if (roleNav.hideDashboard && roleNav.landingPath !== '/dashboard') {
      return response.redirect(roleNav.landingPath)
    }

    const isRegistrationClerk = roleNav.isRegistrationClerk

    const [{ count: totalPatients }] = await db.from('patients').count('* as count')
    const [{ count: totalHouseholds }] = await db.from('households').count('* as count')

    const todayShiftRow = await db
      .from('shift_reports')
      .whereRaw('DATE(report_date) = ?', [DateTime.now().toISODate()])
      .sum('total_patients_seen as total')
      .first()
    const todayShiftPatients = Number(todayShiftRow?.total ?? 0)

    const recentPatients = await db
      .from('patients')
      .select(
        'patient_id',
        'full_name',
        'gender',
        'date_of_birth',
        'household_head_of_house',
        'barcode',
        'source_created_at'
      )
      .orderBy('source_created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(8)

    const impactNumbers = await db
      .from('impact_numbers')
      .orderBy('metric')
      .select('metric', 'value', 'description')

    const stageRows = await db
      .from('encounters')
      .whereNull('deleted_at')
      .whereNot('current_status', 'cancelled')
      .select('current_stage')
      .count('* as total')
      .groupBy('current_stage')
    const encounterStageCounts: Record<string, number> = {}
    for (const row of stageRows) {
      encounterStageCounts[String(row.current_stage)] = Number(row.total)
    }

    if (user) {
      const myScreeningReviewCount = await Encounter.query()
        .whereNull('deleted_at')
        .where('current_stage', EncounterStage.ScreeningReview)
        .whereIn('current_status', ['queued', 'in_progress'])
        .whereHas('labRequests', (q) => q.where('requested_by', user.id))
        .count('* as total')
      encounterStageCounts[EncounterStage.ScreeningReview] = Number(
        (myScreeningReviewCount[0] as any)?.$extras?.total ?? 0
      )
    }

    const [{ count: totalEncounters }] = await db
      .from('encounters')
      .whereNull('deleted_at')
      .count('* as count')
    const [{ count: activeEncounters }] = await db
      .from('encounters')
      .whereNull('deleted_at')
      .whereNotIn('current_status', ['completed', 'cancelled'])
      .count('* as count')
    const [{ count: completedEncounters }] = await db
      .from('encounters')
      .whereNull('deleted_at')
      .where('current_status', 'completed')
      .count('* as count')

    const recentEncounters = await db
      .from('encounters as e')
      .join('patients as p', 'p.id', 'e.patient_id')
      .whereNull('e.deleted_at')
      .select(
        'e.id',
        'e.encounter_number',
        'e.current_stage',
        'e.current_status',
        'e.priority_level',
        'e.visit_type',
        'e.started_at',
        'p.full_name',
        'p.patient_id as patient_code'
      )
      .orderBy('e.started_at', 'desc')
      .orderBy('e.id', 'desc')
      .limit(10)

    const trendStart = DateTime.now().minus({ days: 6 }).startOf('day')
    const trendRows = await db
      .from('encounters')
      .whereNull('deleted_at')
      .whereBetween('started_at', [
        trendStart.toSQL({ includeOffset: false })!,
        DateTime.now().toSQL({ includeOffset: false })!,
      ])
      // to_char keeps YYYY-MM-DD keys; pg DATE otherwise arrives as a JS Date and
      // String(date) never matches Luxon toISODate() lookups (chart stays at 0).
      .select(db.raw("to_char(DATE(started_at), 'YYYY-MM-DD') as encounter_date"))
      .count('* as total')
      .groupByRaw("to_char(DATE(started_at), 'YYYY-MM-DD')")
    const trendMap: Record<string, number> = {}
    for (const row of trendRows) {
      trendMap[String(row.encounter_date)] = Number(row.total)
    }

    const encounterTrendLabels: string[] = []
    const encounterTrendValues: number[] = []
    for (let i = 6; i >= 0; i--) {
      const day = DateTime.now().minus({ days: i })
      const dayKey = day.toISODate()!
      encounterTrendLabels.push(day.toFormat('ccc'))
      encounterTrendValues.push(trendMap[dayKey] ?? 0)
    }

    const insightFlashes = await DashboardInsightFlashes.build()

    return inertia.render('dashboard', {
      isRegistrationClerk,
      totalPatients: Number(totalPatients),
      totalHouseholds: Number(totalHouseholds),
      activePatients: Number(totalPatients),
      todayShiftPatients,
      recentPatients,
      impactNumbers,
      encounterStageCounts,
      totalEncounters: Number(totalEncounters),
      activeEncounters: Number(activeEncounters),
      completedEncounters: Number(completedEncounters),
      recentEncounters,
      encounterTrendLabels,
      encounterTrendValues,
      insightFlashes,
    })
  }
}
