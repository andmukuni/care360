/*
|--------------------------------------------------------------------------
| Payments configuration
|--------------------------------------------------------------------------
|
| Ported from the Laravel `config/payments.php`. Values are read from the
| environment (process.env) so secrets stay out of version control. The
| `start/env.ts` schema is intentionally NOT edited here — the coordinator
| should add the variables listed in the phase report to that schema if
| strict validation is desired. The sandbox driver ignores all credentials.
|
*/

function envString(key: string, fallback: string): string {
  const value = process.env[key]
  return value === undefined || value === '' ? fallback : value
}

function envOptional(key: string): string | null {
  const value = process.env[key]
  return value === undefined || value === '' ? null : value
}

function envInt(key: string, fallback: number): number {
  const value = process.env[key]
  if (value === undefined || value === '') {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const paymentsConfig = {
  /*
  | Which gateway driver handles *online* subscription payments from the
  | patient portal. Supported out of the box: "sandbox" (auto-confirms) and
  | "lenco" (direct mobile-money collections).
  */
  gateway: envString('PAYMENTS_GATEWAY', 'sandbox'),

  currency: envString('PAYMENTS_CURRENCY', 'ZMW'),

  /* Country code sent to mobile-money providers (Lenco): "zm" or "mw". */
  country: envString('PAYMENTS_COUNTRY', 'zm'),

  /*
  | Who pays the gateway fee on a collection: "merchant" (hospital) or
  | "customer" (added to what the patient pays). Lenco default: merchant.
  */
  feeBearer: envString('PAYMENTS_FEE_BEARER', 'merchant'),

  /*
  | How long the app/web should keep polling a pending mobile-money collection
  | before telling the user to use the "Check status" button (seconds).
  */
  pollTimeout: envInt('PAYMENTS_POLL_TIMEOUT', 120),

  /*
  | Gateway credentials, read from .env so secrets stay out of version control.
  */
  gateways: {
    sandbox: {
      // No credentials required. Simulates an instant successful payment.
    },

    // Lenco direct mobile-money collections (MTN / Airtel / Zamtel).
    lenco: {
      baseUrl: envString('LENCO_BASE_URL', 'https://api.lenco.co/access/v2'),
      token: envOptional('LENCO_API_TOKEN'),
      webhookSecret: envOptional('LENCO_WEBHOOK_SECRET'),
      otpPath: envString('LENCO_OTP_PATH', '/collections/mobile-money/otp'),
    },

    stripe: {
      key: envOptional('STRIPE_KEY'),
      secret: envOptional('STRIPE_SECRET'),
      webhookSecret: envOptional('STRIPE_WEBHOOK_SECRET'),
    },

    flutterwave: {
      publicKey: envOptional('FLW_PUBLIC_KEY'),
      secretKey: envOptional('FLW_SECRET_KEY'),
      webhookSecret: envOptional('FLW_WEBHOOK_SECRET'),
    },
  },
}

export default paymentsConfig
