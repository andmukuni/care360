import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import ClinicSettings from '#support/clinic_settings'
import { todayCalendarRange } from '#support/dashboard/today_patients_seen'
import { EncounterStatus } from '#enums/encounter_status'
import { safeCacheGetOrSet } from '#services/cache/safe_cache'
import {
  PUBLIC_STATS_CACHE_KEY,
  PUBLIC_STATS_CACHE_TTL,
  applyLiveStageCounts,
  type PublicStatsPayload,
} from '#support/public/public_stats'

/**
 * Aggregate, non-identifying clinic stats for the public website.
 */
export default class PublicStatsService {
  async snapshot(): Promise<PublicStatsPayload> {
    return safeCacheGetOrSet(
      'public.stats',
      () =>
        cache.getOrSet({
          key: PUBLIC_STATS_CACHE_KEY,
          ttl: PUBLIC_STATS_CACHE_TTL,
          factory: () => this.loadSnapshot(),
        }),
      () => this.loadSnapshot()
    )
  }

  private async loadSnapshot(): Promise<PublicStatsPayload> {
    const timezone = await ClinicSettings.timezone()
    const facilityName = await ClinicSettings.facilityName()
    const { dayStart, dayEnd } = todayCalendarRange(timezone)
    const dayStartSql = dayStart.toSQL({ includeOffset: false })!
    const dayEndSql = dayEnd.toSQL({ includeOffset: false })!

    const [encounterTotals, encountersToday, patientTotals, attendedToday, liveRows] =
      await Promise.all([
        db
          .from('encounters')
          .whereNull('deleted_at')
          .select(
            db.raw('COUNT(*) as total'),
            db.raw(
              `COUNT(*) FILTER (WHERE current_status = '${EncounterStatus.Completed}') as completed`
            ),
            db.raw(
              `COUNT(*) FILTER (WHERE current_status = '${EncounterStatus.Cancelled}') as cancelled`
            ),
            db.raw(
              `COUNT(*) FILTER (WHERE current_status NOT IN ('${EncounterStatus.Completed}', '${EncounterStatus.Cancelled}')) as active`
            )
          )
          .first(),
        db
          .from('encounters')
          .whereNull('deleted_at')
          .whereNot('current_status', EncounterStatus.Cancelled)
          .whereNotNull('started_at')
          .whereBetween('started_at', [dayStartSql, dayEndSql])
          .count('* as total')
          .first(),
        db
          .from('patients')
          .select(
            db.raw('COUNT(*) as total'),
            db.raw(
              "COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(gender, ''))) IN ('male', 'm')) as male"
            ),
            db.raw(
              "COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(gender, ''))) IN ('female', 'f')) as female"
            )
          )
          .first(),
        db
          .from('encounters')
          .whereNull('deleted_at')
          .whereNot('current_status', EncounterStatus.Cancelled)
          .whereNotNull('patient_id')
          .whereNotNull('started_at')
          .whereBetween('started_at', [dayStartSql, dayEndSql])
          .countDistinct('patient_id as total')
          .first(),
        db
          .from('encounters')
          .whereNull('deleted_at')
          .whereIn('current_status', [
            EncounterStatus.Started,
            EncounterStatus.Queued,
            EncounterStatus.InProgress,
          ])
          .select('current_stage')
          .count('* as total')
          .groupBy('current_stage'),
      ])

    const patientsTotal = Number(patientTotals?.total ?? 0)
    const patientsMale = Number(patientTotals?.male ?? 0)
    const patientsFemale = Number(patientTotals?.female ?? 0)

    return {
      ok: true,
      generated_at: new Date().toISOString(),
      timezone,
      facility_name: facilityName,
      encounters: {
        total: Number(encounterTotals?.total ?? 0),
        today: Number(encountersToday?.total ?? 0),
        active: Number(encounterTotals?.active ?? 0),
        completed: Number(encounterTotals?.completed ?? 0),
        cancelled: Number(encounterTotals?.cancelled ?? 0),
      },
      patients: {
        total: patientsTotal,
        male: patientsMale,
        female: patientsFemale,
        unspecified: Math.max(0, patientsTotal - patientsMale - patientsFemale),
        attended_today: Number(attendedToday?.total ?? 0),
      },
      live: applyLiveStageCounts(liveRows),
    }
  }
}
