import type { HttpContext } from '@adonisjs/core/http'
import type Invoice from '#models/invoice'
import type PaymentGateway from '#services/payments/payment_gateway'
import CheckoutResult from '#services/payments/checkout_result'
import PaymentConfirmation from '#services/payments/payment_confirmation'
import { num } from '#support/money_helpers'

/**
 * Development / testing gateway. It does not move real money: checkout sends the
 * patient to an internal "simulate gateway" page where they can confirm or
 * cancel, which posts back to the standard webhook endpoint. This lets the full
 * online flow (checkout → redirect → webhook → reconciliation) be exercised
 * without any external provider or credentials.
 *
 * NOTE: the redirect target used to be resolved via the named route
 * `portal.memberships.sandbox`. Until that portal route exists in Adonis the
 * path is built directly; the coordinator should swap this for `router.makeUrl`
 * once the portal routes are registered.
 */
export default class SandboxGateway implements PaymentGateway {
  name(): string {
    return 'sandbox'
  }

  startCheckout(invoice: Invoice): CheckoutResult {
    const reference = 'SBX-' + invoice.id + '-' + invoice.invoiceNumber

    return new CheckoutResult(`/portal/memberships/sandbox/${invoice.id}`, reference)
  }

  parseWebhook(request: HttpContext['request']): PaymentConfirmation | null {
    const invoiceId = Number.parseInt(String(request.input('invoice_id', 0)), 10)
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return null
    }

    return new PaymentConfirmation(
      invoiceId,
      num(request.input('amount', 0)),
      String(request.input('reference', 'SBX-' + invoiceId)),
      request.input('status', 'success') === 'success'
    )
  }
}
