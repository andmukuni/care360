import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import logger from '@adonisjs/core/services/logger'
import Invoice from '#models/invoice'
import Patient from '#models/patient'
import PaymentCollection from '#models/payment_collection'
import MobileMoneyPaymentService from '#services/payments/mobile_money_payment_service'
import { abortUnless } from '#services/portal/portal_errors'

/**
 * Direct mobile-money payments for the patient app: initiate a charge against an
 * invoice, submit the OTP if asked, poll/check status, and retry a failed one.
 *
 * Ported from App\Http\Controllers\Api\Portal\PaymentController. Reuses the
 * Phase 6 MobileMoneyPaymentService and reproduces the PaymentCollectionResource
 * JSON shape inline. Ownership is scoped to the authenticated patient (the
 * guardian / token user), mirroring the Laravel controller.
 */

const OPERATORS = ['mtn', 'airtel', 'zamtel', 'tnm']

const payValidator = vine.compile(
  vine.object({
    phone: vine.string().maxLength(20),
    operator: vine.enum(OPERATORS),
  })
)

const otpValidator = vine.compile(
  vine.object({
    otp: vine.string().maxLength(12),
  })
)

export default class PaymentController {
  private readonly payments = new MobileMoneyPaymentService()

  /** GET /payments — the patient's recent collection attempts (transactions). */
  async index(ctx: HttpContext) {
    const patient = this.user(ctx)

    const collections = await PaymentCollection.query()
      .where('patientId', patient.id)
      .preload('invoice', (query) => query.select('id', 'invoiceNumber'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(50)

    return ctx.response.ok({
      data: collections.map((collection) => paymentCollectionToArray(collection)),
    })
  }

  /** POST /billing/invoices/{invoice}/pay — start a mobile-money collection. */
  async pay(ctx: HttpContext) {
    const patient = this.user(ctx)
    const invoice = await Invoice.findOrFail(ctx.params.invoice ?? ctx.params.id)
    abortUnless(Number(invoice.patientId) === Number(patient.id), 403)

    const { phone, operator } = await ctx.request.validateUsing(payValidator)

    const result = await this.guard(ctx, () => this.payments.initiate(invoice, phone, operator))
    if (!result.ok) {
      return result.response
    }

    return this.respond(ctx, result.collection, 201)
  }

  /** POST /payments/{collection}/otp — submit the OTP the customer received. */
  async submitOtp(ctx: HttpContext) {
    const patient = this.user(ctx)
    const collection = await PaymentCollection.findOrFail(ctx.params.collection ?? ctx.params.id)
    abortUnless(Number(collection.patientId) === Number(patient.id), 403)

    const { otp } = await ctx.request.validateUsing(otpValidator)

    const result = await this.guard(ctx, () => this.payments.submitOtp(collection, otp))
    if (!result.ok) {
      return result.response
    }

    return this.respond(ctx, result.collection)
  }

  /** GET /payments/{collection} — requery + return the latest status. */
  async status(ctx: HttpContext) {
    const patient = this.user(ctx)
    const collection = await PaymentCollection.findOrFail(ctx.params.collection ?? ctx.params.id)
    abortUnless(Number(collection.patientId) === Number(patient.id), 403)

    const result = await this.guard(ctx, () => this.payments.refresh(collection))
    if (!result.ok) {
      return result.response
    }

    return this.respond(ctx, result.collection)
  }

  /** POST /payments/{collection}/retry — start a fresh attempt for a failed one. */
  async retry(ctx: HttpContext) {
    const patient = this.user(ctx)
    const collection = await PaymentCollection.findOrFail(ctx.params.collection ?? ctx.params.id)
    abortUnless(Number(collection.patientId) === Number(patient.id), 403)

    const result = await this.guard(ctx, () => this.payments.retry(collection))
    if (!result.ok) {
      return result.response
    }

    return this.respond(ctx, result.collection, 201)
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async respond(ctx: HttpContext, collection: PaymentCollection, statusCode = 200) {
    await collection.load('invoice', (query) => query.select('id', 'invoiceNumber'))

    return ctx.response.status(statusCode).send({ data: paymentCollectionToArray(collection) })
  }

  /**
   * Run a service call, converting gateway/runtime errors into a 422 that mirrors
   * Laravel's ValidationException(['payment' => [...]]).
   *
   * PORT-GAP: Laravel distinguished RuntimeException (surface message) from other
   * throwables (log + generic message). The AdonisJS MobileMoneyPaymentService
   * throws plain Error for business failures, so the error message is surfaced;
   * unexpected errors are logged and given the generic provider message.
   */
  private async guard(
    ctx: HttpContext,
    fn: () => Promise<PaymentCollection>
  ): Promise<{ ok: true; collection: PaymentCollection } | { ok: false; response: unknown }> {
    try {
      return { ok: true, collection: await fn() }
    } catch (error) {
      if (error instanceof Error && error.message) {
        return {
          ok: false,
          response: ctx.response.unprocessableEntity({ errors: { payment: [error.message] } }),
        }
      }

      logger.error({ error }, 'Mobile-money payment failed')

      return {
        ok: false,
        response: ctx.response.unprocessableEntity({
          errors: { payment: ['We could not reach the payment provider. Please try again.'] },
        }),
      }
    }
  }

  private user(ctx: HttpContext): Patient {
    return ctx.auth.use('patient_api').user as Patient
  }
}

// ── resource shape ───────────────────────────────────────────────────────────

const OPEN_STATUSES = ['pending', 'otp-required', 'pay-offline']

function paymentCollectionToArray(collection: PaymentCollection): Record<string, unknown> {
  const status = String(collection.status)

  const result: Record<string, unknown> = {
    id: collection.id,
    reference: collection.reference,
    invoice_id: collection.invoiceId,
    operator: collection.operator,
    phone: collection.phone,
    amount: String(collection.amount),
    currency: collection.currency,
    status,
    needs_otp: status === 'otp-required',
    is_open: OPEN_STATUSES.includes(status),
    is_successful: status === 'successful',
    can_retry: status === 'failed',
    failure_reason: collection.failureReason,
    created_at: iso(collection.createdAt),
    last_checked_at: iso(collection.lastCheckedAt),
  }

  const preloaded = (collection as any).$preloaded
  if (preloaded && 'invoice' in preloaded) {
    result.invoice_number = collection.invoice?.invoiceNumber ?? null
  }

  return result
}

function iso(dt: DateTime | null | undefined): string | null {
  return dt ? dt.toISO({ suppressMilliseconds: true }) : null
}
