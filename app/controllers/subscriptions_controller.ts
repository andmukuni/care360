import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import Invoice from '#models/invoice'
import MembershipPlan from '#models/membership_plan'
import Patient from '#models/patient'
import WellnessFundAccount from '#models/wellness_fund_account'
import WellnessFundService from '#services/membership/wellness_fund_service'
import { num } from '#support/money_helpers'

/**
 * Wellness fund (subscription) enrollment & payment desk.
 * Ported from App\Http\Controllers\SubscriptionController.
 *
 * The Laravel version paginated accounts server-side; here `index` returns the
 * full ordered set (with status counts) so the Inertia page can filter/paginate
 * client-side via the shared DataTable.
 */
const OPEN_INVOICE_STATUSES = ['issued', 'partial']

export default class SubscriptionsController {
  private readonly wellnessFund = new WellnessFundService()

  async index({ request, inertia }: HttpContext) {
    const status = String(request.qs().status ?? '').trim() || null

    const accounts = await WellnessFundAccount.query()
      .if(status, (q) => q.where('status', status!))
      .preload('patient', (q) => q.select('id', 'patientId', 'fullName'))
      .preload('membershipPlan', (q) => q.select('id', 'name', 'tier'))
      .orderBy('id', 'desc')

    // Outstanding invoice lookup (drives the "Pay" action per account).
    const accountIds = accounts.map((a) => a.id)
    const outstanding = new Map<number, number>()
    if (accountIds.length > 0) {
      const openInvoices = await Invoice.query()
        .whereIn('subscriptionId', accountIds)
        .whereIn('status', OPEN_INVOICE_STATUSES)
        .where('balanceDue', '>', 0)
      for (const inv of openInvoices) {
        outstanding.set(inv.subscriptionId!, num(inv.balanceDue))
      }
    }

    const plans = await MembershipPlan.query()
      .where('membershipType', 'individual')
      .where('isActive', true)
      .orderBy('sortOrder')
      .orderBy('tier')

    const countRows = await db
      .from('wellness_fund_accounts')
      .select('status')
      .count('* as total')
      .groupBy('status')
    const counts: Record<string, number> = {}
    for (const row of countRows) {
      counts[String(row.status)] = Number(row.total)
    }

    return inertia.render('subscriptions/index', {
      subscriptions: accounts.map((a) => ({
        id: a.id,
        status: a.status,
        balance: num(a.balance),
        totalDeposited: num(a.totalDeposited),
        patientName: a.patient?.fullName ?? '—',
        patientNumber: a.patient?.patientId ?? null,
        planName: a.membershipPlan?.name ?? '—',
        planTier: a.membershipPlan?.tier ?? null,
        outstandingAmount: outstanding.get(a.id) ?? 0,
        hasOutstanding: outstanding.has(a.id),
        enrolledAt: a.enrolledAt ? a.enrolledAt.toISO() : null,
      })),
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        tier: p.tier,
        minimumDeposit: num(p.minimumDeposit),
      })),
      counts,
      status,
    })
  }

  async searchPatients({ request, response }: HttpContext) {
    const term = String(request.qs().q ?? '').trim()

    const patients = await Patient.query()
      .if(term !== '', (q) =>
        q.whereILike('fullName', `%${term}%`).orWhereILike('patientId', `%${term}%`)
      )
      .select('id', 'patientId', 'fullName')
      .limit(15)

    return response.json(
      patients.map((p) => ({
        id: p.id,
        label: `${p.fullName} · ${p.patientId}`,
      }))
    )
  }

  async store({ request, response, session, auth }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        patient_id: vine.number(),
        membership_plan_id: vine.number(),
        amount: vine.number().min(1),
        mark_paid: vine.boolean().optional(),
        payment_method: vine.string().trim().maxLength(40).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)

    const patient = await Patient.find(data.patient_id)
    const plan = await MembershipPlan.find(data.membership_plan_id)
    if (!patient || !plan) {
      session.flash('error', 'Selected patient or plan could not be found.')
      return response.redirect().back()
    }

    const user = auth.use('web').user ?? null

    try {
      const account = await this.wellnessFund.enroll(patient, plan, data.amount, {
        provider: 'manual',
        enrolledBy: user,
      })

      if (data.mark_paid) {
        const invoice = await Invoice.query()
          .where('subscriptionId', account.id)
          .orderBy('id', 'desc')
          .first()
        if (invoice) {
          await this.wellnessFund.recordPaymentAndActivate(
            invoice,
            num(invoice.balanceDue),
            data.payment_method || 'cash',
            user,
            'manual'
          )
        }
      }

      session.flash('success', `Enrolled ${patient.fullName} in ${plan.name} wellness fund.`)
      return response.redirect().toPath('/subscriptions')
    } catch (error) {
      session.flash('error', error instanceof Error ? error.message : 'Enrollment failed.')
      return response.redirect().back()
    }
  }

  async pay({ params, request, response, session, auth }: HttpContext) {
    const account = await WellnessFundAccount.findOrFail(params.subscription)
    const validator = vine.compile(
      vine.object({
        payment_method: vine.string().trim().maxLength(40),
      })
    )
    const { payment_method } = await request.validateUsing(validator)

    const invoice = await Invoice.query()
      .where('subscriptionId', account.id)
      .whereIn('status', OPEN_INVOICE_STATUSES)
      .orderBy('id', 'desc')
      .first()

    if (!invoice) {
      session.flash('error', 'No outstanding invoice for this account.')
      return response.redirect().back()
    }

    await this.wellnessFund.recordPaymentAndActivate(
      invoice,
      num(invoice.balanceDue),
      payment_method,
      auth.use('web').user ?? null,
      'manual'
    )

    session.flash('success', 'Payment recorded and fund credited.')
    return response.redirect().back()
  }

  async cancel({ params, response, session }: HttpContext) {
    const account = await WellnessFundAccount.findOrFail(params.subscription)

    try {
      await this.wellnessFund.cancel(account)
      session.flash('success', 'Wellness fund account cancelled.')
    } catch (error) {
      session.flash('error', error instanceof Error ? error.message : 'Cancellation failed.')
    }

    return response.redirect().back()
  }
}
