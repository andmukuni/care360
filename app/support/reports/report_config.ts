import ClinicSettings from '#support/clinic_settings'

/**
 * MoH register header metadata + background-export flags.
 *
 * Ported from Laravel `config/reports.php`. Province/district stay on env;
 * facility name prefers Settings → Clinic via ClinicSettings.
 */
export const reportConfig = {
  province: process.env.REPORT_PROVINCE ?? 'Central',
  district: process.env.REPORT_DISTRICT ?? 'Chibombo',

  /**
   * Sync fallback for callers that cannot await. Prefer `facilityName()`.
   * @deprecated Use `await reportConfig.facilityName()` instead.
   */
  get facilityNameSync(): string {
    return process.env.REPORT_FACILITY_NAME ?? process.env.APP_NAME ?? 'International Hospital Zambia'
  },

  /** Effective facility name from clinic settings (DB → env → default). */
  async facilityName(): Promise<string> {
    return ClinicSettings.facilityName()
  },

  /**
   * When true, exports run inline in-request instead of via the (future) queue
   * worker. Defaults to true only in the `local` environment, matching Laravel.
   */
  get processExportsSync(): boolean {
    const raw = process.env.REPORTS_PROCESS_EXPORTS_SYNC
    if (raw !== undefined) {
      return raw === 'true' || raw === '1'
    }
    return (process.env.NODE_ENV ?? process.env.APP_ENV ?? 'production') === 'local'
  },
} as const
