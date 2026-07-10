/*
|--------------------------------------------------------------------------
| Payments & billing routes (Phase 6)
|--------------------------------------------------------------------------
|
| Ported from the Laravel `PaymentWebhookController` (routes/web.php) and the
| patient portal `Api\Portal\PaymentController` (routes/api.php).
|
| IMPORTANT (coordinator): the inbound gateway webhook
|   POST /payments/webhook/:provider
| MUST be exempt from CSRF verification. In Laravel this was done in
| bootstrap/app.php; in this Adonis app the equivalent is adding the path to
| the `csrf.exceptions` list in `config/shield.ts`, e.g.:
|   csrf: { enabled: true, exceptions: ['/payments/webhook/*'], ... }
| This file intentionally does NOT edit config/shield.ts.
|
| The patient payment action routes authenticate against the `patient_api`
| guard (mirrors the Laravel `portal.api.auth` middleware). The coordinator may
| additionally attach portal middleware (rate limiting, portal-active checks).
|
| This module is imported from a dedicated file and must be registered by the
| coordinator from the root `start/routes.ts` (e.g. `import './routes/payments.js'`).
*/

import router from '@adonisjs/core/services/router'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import Invoice from '#models/invoice'
import PaymentCollection from '#models/payment_collection'
import LencoCollectionService from '#services/payments/lenco_collection_service'
import MobileMoneyPaymentService from '#services/payments/mobile_money_payment_service'
import PaymentGatewayManager from '#services/payments/payment_gateway_manager'
import SubscriptionService from '#services/membership/subscription_service'
import { num } from '#support/money_helpers'

const gateways = new PaymentGatewayManager()
const lenco = new LencoCollectionService()
const mobileMoney = new MobileMoneyPaymentService()
const subscriptions = new SubscriptionService()

const ALLOWED_OPERATORS = ['mtn', 'airtel', 'zamtel', 'tnm']

/**
 * Lenco direct-collection webhook. We verify the signature, locate the
 * collection by its reference, then authoritatively requery Lenco (rather than
 * trust the payload) which settles the invoice on success.
 */
async function handleLenco({ request, response }: HttpContext) {
  const rawBody = request.raw() ?? ''
  const signature = request.header('x-lenco-signature') ?? ''

  if (!(await lenco.verifyWebhook(rawBody, signature))) {
    return response.unauthorized({ error: 'invalid signature' })
  }

  const data = (request.input('data', request.all()) ?? {}) as Record<string, any>
  const reference = String(data?.reference ?? request.input('reference', ''))

  if (reference === '') {
    return response.status(202).send({ ignored: true, note: 'no reference' })
  }

  const collection = await PaymentCollection.query().where('reference', reference).first()

  if (!collection) {
    logger.warn({ reference }, 'Lenco webhook for unknown collection')

    return response.notFound({ error: 'unknown collection' })
  }

  await mobileMoney.refresh(collection)
  await collection.refresh()

  return response.ok({ ok: true, status: collection.status })
}

/**
 * Receives inbound payment confirmations from online gateways. Unauthenticated
 * and CSRF-exempt — trust comes from the gateway's own signature verification
 * inside PaymentGateway.parseWebhook() (or Lenco's HMAC check).
 */
router.post('/payments/webhook/:provider', async (ctx) => {
  const { request, response, params } = ctx
  const provider = String(params.provider)

  if (provider === 'lenco') {
    return handleLenco(ctx)
  }

  let gateway
  try {
    gateway = gateways.driver(provider)
  } catch {
    return response.notFound({ error: 'unknown gateway' })
  }

  const confirmation = gateway.parseWebhook(request)

  if (!confirmation || !confirmation.successful) {
    return response.status(202).send({ ignored: true })
  }

  const invoice = await Invoice.find(confirmation.invoiceId)

  if (!invoice) {
    logger.warn({ provider, invoice: confirmation.invoiceId }, 'Payment webhook for unknown invoice')

    return response.notFound({ error: 'unknown invoice' })
  }

  // Idempotency: ignore if already settled.
  if (num(invoice.balanceDue) <= 0) {
    return response.ok({ ok: true, note: 'already settled' })
  }

  const amount = confirmation.amount > 0 ? confirmation.amount : num(invoice.balanceDue)

  await subscriptions.recordPaymentAndActivate(
    invoice,
    amount,
    'online',
    null,
    gateway.name(),
    confirmation.providerReference
  )

  return response.ok({ ok: true })
})

/**
 * Direct mobile-money payments for the patient app. Everything happens in-app:
 * initiate a charge against an invoice, submit the OTP if asked, poll/check the
 * status, and retry a failed one. No hosted checkout / redirect.
 *
 * NOTE (Phase 8 reconciliation): the mobile app actually calls these under
 * /api/v1/portal/* (see routes/api.php). Those canonical routes are now defined
 * in start/routes/api.ts (delegating to api/portal/payment_controller.ts). This
 * legacy /portal/* group is retained for backward compatibility and is NOT
 * removed.
 */
router
  .group(() => {
    /** POST /billing/invoices/:invoice/pay — start a mobile-money collection. */
    router.post('/billing/invoices/:invoice/pay', async (ctx) => {
      const { request, response } = ctx
      const patient = await authenticatePatient(ctx)

      const invoice = await Invoice.find(request.param('invoice'))
      if (!invoice) {
        return response.notFound({ error: 'unknown invoice' })
      }
      if (Number(invoice.patientId) !== Number(patient.id)) {
        return response.forbidden({ error: 'forbidden' })
      }

      const phone = String(request.input('phone', '')).trim()
      const operator = String(request.input('operator', ''))
      if (phone === '' || phone.length > 20 || !ALLOWED_OPERATORS.includes(operator)) {
        return response.unprocessableEntity({ errors: { payment: ['Invalid phone or operator.'] } })
      }

      return guarded(ctx, 201, () => mobileMoney.initiate(invoice, phone, operator))
    })

    /** GET /payments/:collection — requery + return the latest status. */
    router.get('/payments/:collection', async (ctx) => {
      const collection = await ownedCollection(ctx)
      if (!collection) return

      return guarded(ctx, 200, () => mobileMoney.refresh(collection))
    })

    /** POST /payments/:collection/otp — submit the OTP the customer received. */
    router.post('/payments/:collection/otp', async (ctx) => {
      const { request, response } = ctx
      const collection = await ownedCollection(ctx)
      if (!collection) return

      const otp = String(request.input('otp', '')).trim()
      if (otp === '' || otp.length > 12) {
        return response.unprocessableEntity({ errors: { otp: ['A valid OTP is required.'] } })
      }

      return guarded(ctx, 200, () => mobileMoney.submitOtp(collection, otp))
    })

    /** POST /payments/:collection/retry — start a fresh attempt for a failed one. */
    router.post('/payments/:collection/retry', async (ctx) => {
      const collection = await ownedCollection(ctx)
      if (!collection) return

      return guarded(ctx, 201, () => mobileMoney.retry(collection))
    })
  })
  .prefix('/portal')

// ── helpers ─────────────────────────────────────────────────────────────────

/** Authenticate the caller against the patient API guard. */
async function authenticatePatient(ctx: HttpContext) {
  return ctx.auth.authenticateUsing(['patient_api', 'patient'])
}

/** Resolve a PaymentCollection route param and assert the caller owns it. */
async function ownedCollection(ctx: HttpContext): Promise<PaymentCollection | undefined> {
  const patient = await authenticatePatient(ctx)
  const collection = await PaymentCollection.find(ctx.request.param('collection'))

  if (!collection) {
    ctx.response.notFound({ error: 'unknown collection' })
    return undefined
  }

  if (Number(collection.patientId) !== Number(patient.id)) {
    ctx.response.forbidden({ error: 'forbidden' })
    return undefined
  }

  return collection
}

/** Run a service call, converting gateway/runtime errors into a 422 (mirrors PaymentController::guard). */
async function guarded(
  { response }: HttpContext,
  status: number,
  fn: () => Promise<PaymentCollection>
) {
  try {
    const collection = await fn()
    await collection.load('invoice')

    return response.status(status).send({ data: collection.serialize() })
  } catch (error) {
    logger.error({ error: error?.message }, 'Mobile-money payment failed')

    return response.unprocessableEntity({
      errors: { payment: [error?.message ?? 'We could not reach the payment provider. Please try again.'] },
    })
  }
}
