/**
 * Scheduler blueprint (Phase 7) — NOT wired into the app boot.
 * ────────────────────────────────────────────────────────────────────────────
 * Ported from Laravel `routes/console.php` scheduling. This file documents the
 * cron cadence and exposes ready-to-call task functions. A coordinator should
 * wire these into a real scheduler (e.g. `adonisjs-scheduler`, a cron entry, or
 * a custom `node ace` command run by cron) — see `registerSchedule()` below.
 *
 * Original Laravel cadence:
 *   1. `queue:work --queue=reports,default --stop-when-empty --max-time=55 --tries=3`
 *      everyMinute, withoutOverlapping, runInBackground.
 *        → In this app the queue runs INLINE (see app/services/queue/queue_service.ts),
 *          so there is no separate worker to schedule yet. When a real queue
 *          driver is added, schedule its worker here (every minute).
 *   2. `SendAppointmentReminder` — daily at 08:00.
 *   3. Cleanup of expired ReportExport files — hourly.
 *
 * Shared-hosting note (from the original): a single cron entry every minute runs
 * the scheduler, which in turn triggers the above. Example:
 *   * * * * * cd /path/to/app && node ace scheduler:run >> /dev/null 2>&1
 */
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import ReportExport from '#models/report_export'
import { SendAppointmentReminder } from '../app/jobs/send_appointment_reminder.js'
import { queue } from '#services/queue/queue_service'

/** Task #2 — daily at 08:00. */
export async function runAppointmentReminder(): Promise<void> {
  await queue.dispatch(new SendAppointmentReminder())
}

/**
 * Task #3 — hourly. Delete ReportExport files/rows that have expired, or that
 * failed more than 5 hours ago. Faithful port of the Laravel `Schedule::call`.
 */
export async function cleanupExpiredExports(): Promise<void> {
  const now = DateTime.now()
  const fiveHoursAgo = now.minus({ hours: 5 })

  const expired = await ReportExport.query()
    .where('expires_at', '<', now.toSQL()!)
    .orWhere((q) => {
      q.where('status', 'failed').where('created_at', '<', fiveHoursAgo.toSQL()!)
    })

  for (const exportRow of expired) {
    if (exportRow.filePath) {
      const fullPath = join(process.cwd(), 'storage', 'app', exportRow.filePath)
      if (existsSync(fullPath)) {
        try {
          unlinkSync(fullPath)
        } catch (error) {
          logger.warn({ err: error, file: exportRow.filePath }, 'Failed to delete export file')
        }
      }
    }
    await exportRow.delete()
  }
}

/**
 * Wire the tasks into a scheduler instance. Intentionally NOT called anywhere;
 * a coordinator should invoke this from the chosen scheduler's bootstrap.
 *
 * `scheduler` is intentionally typed loosely so this file has no dependency on
 * a specific scheduling package.
 */
export function registerSchedule(scheduler: {
  call: (fn: () => Promise<void> | void) => { dailyAt: (t: string) => unknown; hourly: () => unknown }
}): void {
  scheduler.call(runAppointmentReminder).dailyAt('08:00')
  scheduler.call(cleanupExpiredExports).hourly()
  // TODO(queue-driver): when a real queue worker exists, schedule it every minute here.
}
