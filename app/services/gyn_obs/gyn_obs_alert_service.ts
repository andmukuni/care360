import { DateTime } from 'luxon'
import type ScreeningRecord from '#models/screening_record'

export interface GynObsAlert {
  type: 'danger' | 'warning' | 'info'
  code: string
  label: string
  detail: string
}

/**
 * GynObsAlertService
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for all Gyn & OBS clinical alert logic.
 * Ported from App\Services\GynObs\GynObsAlertService.
 *
 * All methods are pure (no DB queries) and receive the data they need as
 * arguments, keeping them fast, easily testable, and view-agnostic.
 */
export class GynObsAlertService {
  /** How many years since last cervical screening triggers an "overdue" warning. */
  static readonly CERVICAL_OVERDUE_YEARS = 3

  /** Result values that escalate to danger / warning respectively. */
  static readonly DANGER_RESULTS = ['suspicious_cancer']
  static readonly WARNING_RESULTS = ['abnormal_high_grade']

  /**
   * Return all active alerts for a given ScreeningRecord.
   */
  forRecord(record: ScreeningRecord): GynObsAlert[] {
    const alerts: GynObsAlert[] = []

    const cervicalResult = record.cervicalScreeningResult
    const cervicalDate = record.cervicalScreeningDate
    const screeningDone = record.cervicalScreeningDone

    if (cervicalResult !== null && GynObsAlertService.DANGER_RESULTS.includes(cervicalResult)) {
      alerts.push({
        type: 'danger',
        code: 'CERVICAL_SUSPICIOUS',
        label: 'Suspicious of Cancer',
        detail:
          'Previous cervical screening result indicated findings suspicious of cancer. Urgent referral required.',
      })
    }

    if (cervicalResult !== null && GynObsAlertService.WARNING_RESULTS.includes(cervicalResult)) {
      alerts.push({
        type: 'warning',
        code: 'CERVICAL_HIGH_GRADE',
        label: 'High-Grade Cervical Lesion',
        detail:
          'Previous cervical screening indicated a high-grade lesion (CIN 2/3). Follow-up colposcopy recommended.',
      })
    }

    if (screeningDone === true && cervicalDate instanceof DateTime) {
      if (Math.floor(DateTime.now().diff(cervicalDate, 'years').years) >= GynObsAlertService.CERVICAL_OVERDUE_YEARS) {
        alerts.push(this.overdueAlert(cervicalDate))
      }
    } else if (screeningDone === false) {
      alerts.push({
        type: 'warning',
        code: 'CERVICAL_NEVER_SCREENED',
        label: 'Never Screened',
        detail:
          'Patient has no prior cervical cancer screening on record. WHO guidelines recommend screening every 3–5 years.',
      })
    }

    return alerts
  }

  /**
   * Quick boolean: does a ScreeningRecord carry any dangerous cervical flag?
   */
  hasDangerFlag(record: ScreeningRecord): boolean {
    return this.forRecord(record).some((alert) => alert.type === 'danger')
  }

  /**
   * Calculate Expected Delivery Date (EDD) from LMP using Naegele's Rule.
   * EDD = LMP + 280 days. Returns null when lmp is null.
   */
  calculateEdd(lmp: DateTime | null): DateTime | null {
    if (lmp === null) {
      return null
    }
    return lmp.plus({ days: 280 })
  }

  /**
   * Return the gestational age in weeks and days for a given LMP.
   * Returns null when LMP is null or in the future.
   */
  gestationalAge(
    lmp: DateTime | null
  ): { weeks: number; days: number; total_days: number } | null {
    if (lmp === null || lmp > DateTime.now()) {
      return null
    }

    const totalDays = Math.floor(DateTime.now().diff(lmp, 'days').days)
    const weeks = Math.floor(totalDays / 7)
    const days = totalDays % 7

    return { weeks, days, total_days: totalDays }
  }

  private overdueAlert(lastDate: DateTime): GynObsAlert {
    const years = Math.floor(DateTime.now().diff(lastDate, 'years').years)
    const ago = lastDate.toFormat('LLL yyyy')

    return {
      type: 'warning',
      code: 'CERVICAL_OVERDUE',
      label: 'Cervical Screening Overdue',
      detail: `Last screened ${ago} (${years} year(s) ago). WHO guidelines recommend repeat screening every 3–5 years.`,
    }
  }
}
