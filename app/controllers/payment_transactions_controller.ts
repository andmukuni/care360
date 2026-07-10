import type { HttpContext } from '@adonisjs/core/http'
import PaymentCollection from '#models/payment_collection'
import MobileMoneyPaymentService from '#services/payments/mobile_money_payment_service'
import { num } from '#support/money_helpers'

/**
 * Admin oversight of mobile-money payment transactions.
 * Ported from App\Http\Controllers\PaymentTransactionController.
 *
 * The Laravel version paginated collections server-side; here `index` returns the
 * full ordered set for the client-side DataTable. `checkStatus` and `retry`
 * delegate to the ported MobileMoneyPaymentService (sandbox auto-approves).
 */
const STATUSES = ['pending', 'otp-required', 'pay-offline', 'successful', 'failed']

export default class PaymentTransactionsController {
  private readonly payments = new MobileMoneyPaymentService()

  async index({ request, inertia }: HttpContext) {
    const status = String(request.qs().status ?? '').trim()

    const transactions = await PaymentCollection.query()
      .if(status !== '', (q) => q.where('status', status))
      .preload('patient', (q) => q.select('id', 'fullName', 'patientId'))
      .preload('invoice', (q) => q.select('id', 'invoiceNumber'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    return inertia.render('payment-transactions/index', {
      statuses: STATUSES,
      status,
      transactions: transactions.map((t) => ({
        id: t.id,
        provider: t.provider,
        reference: t.reference,
        gatewayReference: t.gatewayReference,
        operator: t.operator,
        phone: t.phone,
        amount: num(t.amount),
        currency: t.currency,
        status: t.status,
        failureReason: t.failureReason,
        lastCheckedAt: t.lastCheckedAt ? t.lastCheckedAt.toISO() : null,
        createdAt: t.createdAt ? t.createdAt.toISO() : null,
        patientName: t.patient?.fullName ?? '—',
        patientNumber: t.patient?.patientId ?? null,
        invoiceNumber: t.invoice?.invoiceNumber ?? null,
      })),
    })
  }

  async checkStatus({ params, response, session }: HttpContext) {
    const collection = await PaymentCollection.findOrFail(params.collection)

    try {
      await this.payments.refresh(collection)
      await collection.refresh()
      session.flash('success', `Status refreshed: ${collection.status}.`)
    } catch (error) {
      session.flash(
        'error',
        `Could not reach the gateway: ${error instanceof Error ? error.message : 'unknown error'}`
      )
    }

    return response.redirect().back()
  }

  async retry({ params, response, session }: HttpContext) {
    const collection = await PaymentCollection.findOrFail(params.collection)

    try {
      const fresh = await this.payments.retry(collection)
      session.flash('success', `Retry started (status: ${fresh.status}).`)
    } catch (error) {
      session.flash('error', error instanceof Error ? error.message : 'Retry failed.')
    }

    return response.redirect().back()
  }
}
