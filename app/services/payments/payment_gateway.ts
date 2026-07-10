import type { HttpContext } from '@adonisjs/core/http'
import type Invoice from '#models/invoice'
import type CheckoutResult from '#services/payments/checkout_result'
import type PaymentConfirmation from '#services/payments/payment_confirmation'

/**
 * Contract every online payment provider implements. Manual desk payments do
 * not go through a gateway — staff record them directly on the invoice.
 *
 * To add a live provider (Stripe, Flutterwave, a mobile-money API, …):
 *   1. Implement this interface.
 *   2. Register it in PaymentGatewayManager.driver().
 *   3. Put credentials in config/payments.ts (read from .env).
 *   4. Set PAYMENTS_GATEWAY to its name.
 */
export default interface PaymentGateway {
  /** Machine name, e.g. "sandbox", "stripe". Stored on the subscription/payment. */
  name(): string

  /**
   * Begin an online checkout for an issued invoice. Returns where to send the
   * patient and the reference the provider will quote back via webhook.
   */
  startCheckout(invoice: Invoice): CheckoutResult

  /**
   * Verify and parse an inbound webhook request into a normalised confirmation.
   * Return null if the request is invalid / cannot be trusted.
   */
  parseWebhook(request: HttpContext['request']): PaymentConfirmation | null
}
