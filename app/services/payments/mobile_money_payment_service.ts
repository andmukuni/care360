import { DateTime } from 'luxon'
import paymentsConfig from '#config/payments'
import Invoice from '#models/invoice'
import PaymentCollection from '#models/payment_collection'
import LencoCollectionService, { type LencoResult } from '#services/payments/lenco_collection_service'
import SubscriptionService from '#services/membership/subscription_service'
import PaymentSettings from '#support/payment_settings'
import { num, randomAlnum } from '#support/money_helpers'

/** PaymentCollection lifecycle statuses (mirrors the legacy model constants). */
const STATUS_PENDING = 'pending'
const STATUS_OTP_REQUIRED = 'otp-required'
const STATUS_PAY_OFFLINE = 'pay-offline'
const STATUS_SUCCESSFUL = 'successful'
const STATUS_FAILED = 'failed'
const OPEN_STATUSES = [STATUS_PENDING, STATUS_OTP_REQUIRED, STATUS_PAY_OFFLINE]

/**
 * Orchestrates direct mobile-money collections end to end:
 *   initiate → (otp) → (pay-offline) → successful/failed,
 * persisting every step on a PaymentCollection and settling the invoice when the
 * charge succeeds. Gateway-aware: "sandbox" auto-approves; "lenco" calls Lenco.
 */
export default class MobileMoneyPaymentService {
  constructor(
    private readonly lenco: LencoCollectionService = new LencoCollectionService(),
    private readonly subscriptions: SubscriptionService = new SubscriptionService()
  ) {}

  /** Start a collection for an issued, unpaid invoice. */
  async initiate(invoice: Invoice, phone: string, operator: string): Promise<PaymentCollection> {
    if (num(invoice.balanceDue) <= 0) {
      throw new Error('This invoice is already settled.')
    }

    const collection = await PaymentCollection.create({
      patientId: invoice.patientId,
      invoiceId: invoice.id,
      provider: await PaymentSettings.gateway(),
      reference: this.makeReference(invoice),
      operator,
      phone,
      amount: num(invoice.balanceDue),
      currency: paymentsConfig.currency,
      status: STATUS_PENDING,
    })

    return this.dispatch(collection)
  }

  /** Submit the OTP the customer received (status was otp-required). */
  async submitOtp(collection: PaymentCollection, otp: string): Promise<PaymentCollection> {
    if (!this.needsOtp(collection)) {
      return collection
    }

    if (await this.isSandbox(collection)) {
      return this.settleSandbox(collection)
    }

    const result = await this.lenco.submitOtp(collection.reference, otp)

    return this.apply(collection, result)
  }

  /** Requery the gateway and update the collection ("Check status" / polling). */
  async refresh(collection: PaymentCollection): Promise<PaymentCollection> {
    if (!this.isOpen(collection)) {
      return collection
    }

    if (await this.isSandbox(collection)) {
      return this.settleSandbox(collection)
    }

    const result = await this.lenco.status(collection.reference)

    return this.apply(collection, result)
  }

  /** Retry a failed collection as a fresh attempt (new reference). */
  async retry(collection: PaymentCollection): Promise<PaymentCollection> {
    if (!this.canRetry(collection)) {
      throw new Error('Only a failed payment can be retried.')
    }

    await collection.load('invoice')
    const invoice = collection.invoice
    if (!invoice || num(invoice.balanceDue) <= 0) {
      throw new Error('This invoice is no longer payable.')
    }

    return this.initiate(invoice, String(collection.phone ?? ''), String(collection.operator ?? ''))
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async dispatch(collection: PaymentCollection): Promise<PaymentCollection> {
    if (await this.isSandbox(collection)) {
      return this.settleSandbox(collection)
    }

    const result = await this.lenco.initiate(
      collection.reference,
      num(collection.amount),
      String(collection.phone ?? ''),
      String(collection.operator ?? '')
    )

    return this.apply(collection, result)
  }

  /** Apply a normalised gateway result to the collection + settle on success. */
  private async apply(collection: PaymentCollection, result: LencoResult): Promise<PaymentCollection> {
    collection.status = result.status
    collection.gatewayReference = result.lencoId ?? collection.gatewayReference
    collection.meta = result.raw ? JSON.stringify(result.raw) : null
    collection.lastCheckedAt = DateTime.now()
    collection.failureReason =
      result.status === STATUS_FAILED
        ? String(result.raw?.reasonForFailure ?? result.raw?.failureReason ?? 'Payment failed')
        : null
    await collection.save()

    if (this.isSuccessful(collection)) {
      await this.settleInvoice(collection)
    }

    return collection
  }

  private async settleSandbox(collection: PaymentCollection): Promise<PaymentCollection> {
    collection.status = STATUS_SUCCESSFUL
    collection.gatewayReference = collection.gatewayReference || 'SANDBOX-' + randomAlnum(10).toUpperCase()
    collection.lastCheckedAt = DateTime.now()
    await collection.save()

    await this.settleInvoice(collection)

    return collection
  }

  /** Mark the invoice paid (idempotent) and activate any linked subscription. */
  private async settleInvoice(collection: PaymentCollection): Promise<void> {
    await collection.load('invoice')
    const invoice = collection.invoice
    if (!invoice || num(invoice.balanceDue) <= 0) {
      return // nothing to do / already settled
    }

    await this.subscriptions.recordPaymentAndActivate(
      invoice,
      num(collection.amount),
      'online',
      null,
      collection.provider,
      collection.gatewayReference || collection.reference
    )
  }

  private async isSandbox(collection: PaymentCollection): Promise<boolean> {
    return collection.provider === 'sandbox' || (await PaymentSettings.gateway()) === 'sandbox'
  }

  private makeReference(invoice: Invoice): string {
    // Lenco allows alphanumeric plus - . _ only.
    const base = String(invoice.invoiceNumber).replace(/[^A-Za-z0-9._-]/g, '')

    return 'PAY-' + base + '-' + randomAlnum(8).toUpperCase()
  }

  private isOpen(collection: PaymentCollection): boolean {
    return OPEN_STATUSES.includes(collection.status)
  }

  private needsOtp(collection: PaymentCollection): boolean {
    return collection.status === STATUS_OTP_REQUIRED
  }

  private isSuccessful(collection: PaymentCollection): boolean {
    return collection.status === STATUS_SUCCESSFUL
  }

  private isFailed(collection: PaymentCollection): boolean {
    return collection.status === STATUS_FAILED
  }

  private canRetry(collection: PaymentCollection): boolean {
    return this.isFailed(collection)
  }
}
