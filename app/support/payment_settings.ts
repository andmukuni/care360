import SystemSetting from '#models/system_setting'
import paymentsConfig from '#config/payments'

/**
 * Resolves effective payment configuration, preferring values saved in the admin
 * Settings → Payments page (SystemSetting) and falling back to config/.env. This
 * lets the gateway + Lenco credentials be changed from the admin UI without a
 * redeploy, while keeping .env as a sane default / bootstrap source.
 *
 * NOTE: unlike the Laravel original these accessors are async because Lucid DB
 * reads are async. Callers must `await` them.
 */
export default class PaymentSettings {
  private static async value(key: string, fallback: string | null = null): Promise<string | null> {
    const row = await SystemSetting.query().where('group', 'payments').where('key', key).first()
    const saved = row?.value ?? null

    return saved === null || saved === '' ? fallback : saved
  }

  /** Active gateway driver name: "sandbox" or "lenco". */
  static async gateway(): Promise<string> {
    return String((await this.value('gateway', paymentsConfig.gateway)) ?? 'sandbox')
  }

  static async country(): Promise<string> {
    return String((await this.value('country', paymentsConfig.country)) ?? 'zm')
  }

  static async feeBearer(): Promise<string> {
    return String((await this.value('fee_bearer', paymentsConfig.feeBearer)) ?? 'merchant')
  }

  static async lenco(): Promise<{ baseUrl: string; token: string | null; webhookSecret: string | null }> {
    return {
      baseUrl: String((await this.value('lenco_base_url', paymentsConfig.gateways.lenco.baseUrl)) ?? ''),
      token: await this.value('lenco_token', paymentsConfig.gateways.lenco.token),
      webhookSecret: await this.value('lenco_webhook_secret', paymentsConfig.gateways.lenco.webhookSecret),
    }
  }
}
