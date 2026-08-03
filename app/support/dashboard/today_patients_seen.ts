import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import ClinicSettings from '#support/clinic_settings'

export function todayCalendarRange(
  timezone: string,
  now: DateTime = DateTime.now()
): { dayStart: DateTime; dayEnd: DateTime } {
  const dayStart = now.setZone(timezone).startOf('day')
  return { dayStart, dayEnd: dayStart.endOf('day') }
}

/**
 * Distinct patients with a non-cancelled encounter started on the current
 * calendar day (clinic timezone). Resets automatically after midnight.
 */
export async function countPatientsAttendedToday(): Promise<number> {
  const timezone = await ClinicSettings.timezone()
  const { dayStart, dayEnd } = todayCalendarRange(timezone)

  const row = await db
    .from('encounters')
    .whereNull('deleted_at')
    .whereNot('current_status', 'cancelled')
    .whereNotNull('patient_id')
    .whereNotNull('started_at')
    .whereBetween('started_at', [
      dayStart.toSQL({ includeOffset: false })!,
      dayEnd.toSQL({ includeOffset: false })!,
    ])
    .countDistinct('patient_id as total')
    .first()

  return Number(row?.total ?? 0)
}
