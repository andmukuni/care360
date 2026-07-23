import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import PaymentCollection from '#models/payment_collection'
import MobileMoneyPaymentService from '#services/payments/mobile_money_payment_service'
import { num } from '#support/money_helpers'

/**
 * Admin oversight of mobile-money payment transactions.
 * Ported from App\Http\Controllers\PaymentTransactionController.
 *
 * Restricted to the super-admin role (sidebar + route access).
 */

export default class PaymentTransactionsController {
  private readonly payments = new MobileMoneyPaymentService()

  private async ensureSuperAdmin({
    auth,
    response,
    session,
  }: Pick<HttpContext, 'auth' | 'response' | 'session'>) {
    const user = auth.use('web').user
    if (!user || !(await user.hasRole('super-admin'))) {
      session.flash('error', 'Only administrators can manage payment transactions.')
      return response.redirect().toPath('/dashboard')
    }
    return null
  }

  async index(ctx: HttpContext) {
    const denied = await this.ensureSuperAdmin(ctx)
    if (denied) return denied

    const { request, inertia } = ctx
    const filters = request.only(['status', 'search', 'date_from', 'date_to'])
    const status = String(filters.status ?? '').trim()
    const search = String(filters.search ?? '').trim()
    const dateFrom = String(filters.date_from ?? '').trim()
    const dateTo = String(filters.date_to ?? '').trim()

    const transactions = await PaymentCollection.query()
      .if(status !== '', (q) => q.where('status', status))
      .if(search !== '', (q) => {
        q.where((w) => {
          w.whereILike('reference', `%${search}%`)
            .orWhereILike('phone', `%${search}%`)
            .orWhereHas('patient', (pq) => {
              pq.whereILike('fullName', `%${search}%`).orWhereILike('patientId', `%${search}%`)
            })
            .orWhereHas('invoice', (iq) => {
              iq.whereILike('invoiceNumber', `%${search}%`)
            })
        })
      })
      .if(dateFrom !== '', (q) => {
        const from = DateTime.fromISO(dateFrom).startOf('day')
        if (from.isValid) q.where('createdAt', '>=', from.toSQL()!)
      })
      .if(dateTo !== '', (q) => {
        const to = DateTime.fromISO(dateTo).endOf('day')
        if (to.isValid) q.where('createdAt', '<=', to.toSQL()!)
      })
      .preload('patient', (q) => q.select('id', 'fullName', 'patientId'))
      .preload('invoice', (q) => q.select('id', 'invoiceNumber'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    return inertia.render('payment-transactions/index', {
      filters: {
        status,
        search,
        date_from: dateFrom,
        date_to: dateTo,
      },
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
        createdAtFormatted: t.createdAt ? t.createdAt.toFormat('dd LLL yyyy, HH:mm') : null,
        patientName: t.patient?.fullName ?? '—',
        patientNumber: t.patient?.patientId ?? null,
        invoiceNumber: t.invoice?.invoiceNumber ?? null,
      })),
    })
  }

  async checkStatus(ctx: HttpContext) {
    const denied = await this.ensureSuperAdmin(ctx)
    if (denied) return denied

    const { params, response, session } = ctx
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

  async retry(ctx: HttpContext) {
    const denied = await this.ensureSuperAdmin(ctx)
    if (denied) return denied

    const { params, response, session } = ctx
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
