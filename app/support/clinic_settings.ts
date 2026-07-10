import SystemSetting from '#models/system_setting'

const DEFAULT_FACILITY_NAME = 'International Hospital Zambia'
const DEFAULT_LOGO_URL = '/images/app-icon.png'

/**
 * Resolves clinic / facility branding from Settings → Clinic (`system_settings`),
 * falling back to env then hardcoded defaults. Mirrors PaymentSettings /
 * WellnessFundSettings so admin-saved values drive UI, printouts, and reports.
 */
export default class ClinicSettings {
  private static cache: Map<string, string | null> | null = null

  static clearCache(): void {
    this.cache = null
  }

  private static async loadGroup(): Promise<Map<string, string | null>> {
    if (this.cache) return this.cache

    const rows = await SystemSetting.query().where('group', 'clinic')
    const map = new Map<string, string | null>()
    for (const row of rows) {
      map.set(row.key, row.value)
    }
    this.cache = map
    return map
  }

  private static async value(key: string, fallback: string | null = null): Promise<string | null> {
    const group = await this.loadGroup()
    const saved = group.get(key) ?? null
    return saved === null || saved === '' ? fallback : saved
  }

  static async facilityName(): Promise<string> {
    const envFallback = process.env.APP_NAME ?? process.env.REPORT_FACILITY_NAME ?? DEFAULT_FACILITY_NAME
    return String((await this.value('facility_name', envFallback)) ?? DEFAULT_FACILITY_NAME)
  }

  static async facilityCode(): Promise<string> {
    return String((await this.value('facility_code', '')) ?? '')
  }

  static async facilityType(): Promise<string> {
    return String((await this.value('facility_type', 'hospital')) ?? 'hospital')
  }

  static async address(): Promise<string> {
    return String((await this.value('address', '')) ?? '')
  }

  static async phone(): Promise<string> {
    return String((await this.value('phone', '')) ?? '')
  }

  static async email(): Promise<string> {
    return String((await this.value('email', '')) ?? '')
  }

  static async timezone(): Promise<string> {
    return String((await this.value('timezone', 'Africa/Lusaka')) ?? 'Africa/Lusaka')
  }

  static async locale(): Promise<string> {
    return String((await this.value('locale', 'en')) ?? 'en')
  }

  static async currency(): Promise<string> {
    return String((await this.value('currency', 'ZMW')) ?? 'ZMW')
  }

  /** Relative storage path (e.g. `clinic-branding/uuid.png`) or null. */
  static async logoPath(): Promise<string | null> {
    return this.value('logo_path', null)
  }

  /** When true, no logo is shown anywhere in the app. */
  static async hideLogo(): Promise<boolean> {
    return (await this.value('hide_logo', 'no')) === 'yes'
  }

  /**
   * Public URL for the clinic logo, or the default app icon.
   * Returns null when Hide Logo is enabled so consumers can omit the image.
   */
  static async logoUrl(): Promise<string | null> {
    if (await this.hideLogo()) return null
    const path = await this.logoPath()
    if (!path) return DEFAULT_LOGO_URL
    return path.startsWith('/') ? path : `/storage/${path}`
  }

  /** Snapshot used by Inertia shared props and print headers. */
  static async branding(): Promise<{
    name: string
    address: string
    phone: string
    email: string
    logoUrl: string | null
    hideLogo: boolean
    currency: string
  }> {
    const [name, address, phone, email, logoUrl, hideLogo, currency] = await Promise.all([
      this.facilityName(),
      this.address(),
      this.phone(),
      this.email(),
      this.logoUrl(),
      this.hideLogo(),
      this.currency(),
    ])
    return { name, address, phone, email, logoUrl, hideLogo, currency }
  }

  /** Effective defaults used to prefill the Settings form when DB is empty. */
  static defaults(): Record<string, string> {
    return {
      facility_name: process.env.APP_NAME ?? process.env.REPORT_FACILITY_NAME ?? DEFAULT_FACILITY_NAME,
      facility_code: '',
      facility_type: 'hospital',
      address: '',
      phone: '',
      email: '',
      timezone: 'Africa/Lusaka',
      locale: 'en',
      currency: 'ZMW',
      hide_logo: 'no',
      logo_path: '',
    }
  }
}
