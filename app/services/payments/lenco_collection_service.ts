import { createHmac, timingSafeEqual } from 'node:crypto'
import paymentsConfig from '#config/payments'
import PaymentSettings from '#support/payment_settings'
import { round2 } from '#support/money_helpers'

/** Provider-agnostic, normalised Lenco collection result. */
export interface LencoResult {
  status: string
  lencoId: string | null
  reference: string
  raw: Record<string, any>
}

/**
 * Thin client for Lenco direct mobile-money collections (MTN / Airtel / Zamtel).
 *
 * Flow (https://lenco-api.readme.io):
 *   1. initiate()    POST /collections/mobile-money  → status: pending | otp-required | pay-offline
 *   2. submitOtp()   when status === otp-required (customer entered the OTP sent to their phone)
 *   3. (customer authorises the debit on their handset → status pay-offline → successful)
 *   4. status()      GET /collections/status/{reference}  — requery, or wait for the webhook
 *
 * This service ONLY talks to Lenco and normalises its responses. Persisting the
 * collection, marking invoices paid, and the polling UI live in the controller /
 * PaymentCollection model layer.
 */
export default class LencoCollectionService {
  /** Internal, provider-agnostic statuses the rest of the app reasons about. */
  static readonly STATUS_PENDING = 'pending'
  static readonly STATUS_OTP_REQUIRED = 'otp-required'
  static readonly STATUS_PAY_OFFLINE = 'pay-offline'
  static readonly STATUS_SUCCESSFUL = 'successful'
  static readonly STATUS_FAILED = 'failed'

  private static readonly REQUEST_TIMEOUT_MS = 30_000

  name(): string {
    return 'lenco'
  }

  /**
   * Request a debit from the customer's mobile-money wallet.
   */
  async initiate(reference: string, amount: number, phone: string, operator: string): Promise<LencoResult> {
    const data = await this.request('POST', '/collections/mobile-money', {
      amount: round2(amount),
      reference,
      phone,
      operator, // airtel | mtn | zamtel
      country: await PaymentSettings.country(),
      bearer: await PaymentSettings.feeBearer(),
    })

    return this.normalise(data, reference)
  }

  /**
   * Submit the OTP Lenco texted the customer (status was otp-required).
   *
   * NOTE: confirm the exact path in your Lenco dashboard. Override via
   * LENCO_OTP_PATH if it differs.
   */
  async submitOtp(reference: string, otp: string): Promise<LencoResult> {
    const path = paymentsConfig.gateways.lenco.otpPath

    const data = await this.request('POST', path, { reference, otp })

    return this.normalise(data, reference)
  }

  /**
   * Requery a collection's current status (used by the "Check status" button
   * and the polling loop while a payment is pending / pay-offline).
   */
  async status(reference: string): Promise<LencoResult> {
    const data = await this.request('GET', '/collections/status/' + encodeURIComponent(reference))

    return this.normalise(data, reference)
  }

  /**
   * Verify an inbound webhook is genuinely from Lenco before trusting it.
   * Lenco signs the raw body with the webhook secret; compare the digest.
   *
   * @param rawBody  the exact raw request body bytes/string Lenco signed
   * @param signature the `x-lenco-signature` header value
   */
  async verifyWebhook(rawBody: string, signature: string): Promise<boolean> {
    const secret = (await PaymentSettings.lenco()).webhookSecret ?? ''
    if (secret === '') {
      return false
    }

    if (signature === '') {
      return false
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer)
  }

  /** Map a Lenco collection payload to our normalised shape. */
  private normalise(data: Record<string, any>, reference: string): LencoResult {
    const status = String(data?.status ?? LencoCollectionService.STATUS_PENDING)

    return {
      status,
      lencoId: data?.id !== undefined && data?.id !== null ? String(data.id) : null,
      reference: String(data?.reference ?? reference),
      raw: data ?? {},
    }
  }

  /**
   * Perform an authenticated JSON request against the Lenco API. Mirrors the
   * Laravel Http client (`->throw()`): throws on any non-2xx response, and
   * returns the `data` envelope of the JSON body.
   */
  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, any>> {
    const lenco = await PaymentSettings.lenco()
    const token = lenco.token ?? ''
    if (token === '') {
      throw new Error('Lenco API token is not configured (Settings → Payments, or LENCO_API_TOKEN).')
    }

    const url = lenco.baseUrl.replace(/\/$/, '') + path

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LencoCollectionService.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: method === 'POST' && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Lenco request failed (${response.status} ${response.statusText}): ${text}`)
      }

      const json = (await response.json().catch(() => ({}))) as Record<string, any>

      return (json?.data ?? {}) as Record<string, any>
    } finally {
      clearTimeout(timeout)
    }
  }
}
