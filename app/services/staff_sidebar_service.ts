import db from '@adonisjs/lucid/services/db'
import { EncounterStage } from '#enums/encounter_stage'

interface NavBadges {
  stageCounts: Record<string, number>
  pendingAppointmentCount: number
  pendingKycCount: number
}

/**
 * Sidebar queue badges and nav badge counts (mirrors BARCODES View::composer
 * on components.sidebar).
 */
export default class StaffSidebarService {
  private static navBadgesCache: { expiresAt: number; data: NavBadges } | null = null
  private static navBadgesInflight: Promise<NavBadges> | null = null
  private static readonly NAV_BADGES_TTL_MS = 20_000

  /**
   * Load all sidebar badge counts in one round-trip. Results are cached briefly
   * so every Inertia page render does not fan out into several parallel pool
   * acquisitions against the remote database.
   */
  static async navBadges(): Promise<NavBadges> {
    const now = Date.now()
    if (this.navBadgesCache && this.navBadgesCache.expiresAt > now) {
      return this.navBadgesCache.data
    }

    if (this.navBadgesInflight) {
      return this.navBadgesInflight
    }

    this.navBadgesInflight = this.loadNavBadges(now).finally(() => {
      this.navBadgesInflight = null
    })

    return this.navBadgesInflight
  }

  private static async loadNavBadges(now: number): Promise<NavBadges> {
    const [stageRows, appointmentRow, kycRow] = await Promise.all([
      db
        .from('encounters')
        .whereNull('deleted_at')
        .whereIn('current_status', ['queued', 'in_progress'])
        .select('current_stage')
        .count('* as total')
        .groupBy('current_stage'),
      db.from('appointments').where('status', 'pending').count('* as count'),
      db
        .from('patients')
        .whereNotNull('password')
        .where('portal_enabled', false)
        .where((q) => {
          q.whereNull('is_deceased').orWhere('is_deceased', false)
        })
        .count('* as count'),
    ])

    const counts: Record<string, number> = {}
    for (const row of stageRows) {
      counts[String(row.current_stage)] = Number(row.total)
    }

    const data: NavBadges = {
      stageCounts: {
        registration: counts[EncounterStage.Registration] ?? 0,
        triage: counts[EncounterStage.Triage] ?? 0,
        screening: counts[EncounterStage.Screening] ?? 0,
        lab: counts[EncounterStage.Lab] ?? 0,
        screening_review: counts[EncounterStage.ScreeningReview] ?? 0,
        pharmacy: counts[EncounterStage.Pharmacy] ?? 0,
        treatment_room: counts[EncounterStage.TreatmentRoom] ?? 0,
      },
      pendingAppointmentCount: Number(appointmentRow[0]?.count ?? 0),
      pendingKycCount: Number(kycRow[0]?.count ?? 0),
    }

    this.navBadgesCache = {
      expiresAt: now + this.NAV_BADGES_TTL_MS,
      data,
    }

    return data
  }

  static async stageCounts(): Promise<Record<string, number>> {
    return (await this.navBadges()).stageCounts
  }

  static async pendingAppointmentCount(): Promise<number> {
    return (await this.navBadges()).pendingAppointmentCount
  }

  static async pendingKycCount(): Promise<number> {
    return (await this.navBadges()).pendingKycCount
  }
}
