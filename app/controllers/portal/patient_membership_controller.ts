import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import MembershipPlan from '#models/membership_plan'
import Invoice from '#models/invoice'
import WellnessFundAccount from '#models/wellness_fund_account'
import PortalController from '#controllers/portal/portal_controller'
import SubscriptionService from '#services/membership/subscription_service'

const subscribeValidator = vine.compile(
  vine.object({
    billing_cycle: vine.enum(['monthly', 'annual']),
    payment: vine.enum(['manual', 'online']),
  })
)

/**
 * Patient memberships. Ported from Portal\PatientMembershipController.
 *
 * PORT-GAP: the Adonis membership domain is modeled as the "wellness fund"
 * (WellnessFundAccount + WellnessFund/SubscriptionService), not Laravel's
 * PatientSubscription. Enrollment/cancellation map onto SubscriptionService; the
 * external online-gateway checkout redirect and sandbox confirmation are
 * best-effort (a real online checkout should use the Phase 6 gateway manager).
 */
export default class PatientMembershipController extends PortalController {
  private subscriptions = new SubscriptionService()

  async index(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)

    const plans = await MembershipPlan.query().where('is_active', true).orderBy('sort_order', 'asc')
    const current = await patient
      .related('wellnessFundAccounts')
      .query()
      .where('status', 'active')
      .preload('membershipPlan')
      .orderBy('id', 'desc')
      .first()
    const history = await patient
      .related('wellnessFundAccounts')
      .query()
      .preload('membershipPlan')
      .orderBy('id', 'desc')
      .limit(10)

    return ctx.inertia.render('portal/memberships/index', { patient, plans, current, history })
  }

  async subscribe(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const { billing_cycle, payment } = await ctx.request.validateUsing(subscribeValidator)
    const plan = await MembershipPlan.findOrFail(ctx.params.plan)

    if (!plan.isActive) {
      ctx.session.flash('error', 'That plan is not available.')
      return ctx.response.redirect().back()
    }

    await this.subscriptions.subscribe(patient, plan, billing_cycle, {
      provider: payment === 'online' ? 'online' : 'manual',
    } as any)

    ctx.session.flash(
      'success',
      `You've subscribed to the ${plan.name} plan. Please settle the invoice to activate it.`
    )
    return ctx.response.redirect('/portal/memberships')
  }

  async cancel(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const account = await WellnessFundAccount.findOrFail(ctx.params.subscription)

    if (Number(account.patientId) !== Number(patient.id)) {
      return ctx.response.forbidden('Forbidden')
    }

    await this.subscriptions.cancel(account)

    ctx.session.flash('success', 'Subscription cancelled.')
    return ctx.response.redirect('/portal/memberships')
  }

  async sandbox(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const invoice = await Invoice.findOrFail(ctx.params.invoice)

    if (Number(invoice.patientId) !== Number(patient.id)) {
      return ctx.response.forbidden('Forbidden')
    }

    return ctx.inertia.render('portal/memberships/sandbox', { invoice })
  }

  async sandboxConfirm(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const invoice = await Invoice.findOrFail(ctx.params.invoice)

    if (Number(invoice.patientId) !== Number(patient.id)) {
      return ctx.response.forbidden('Forbidden')
    }

    // PORT-GAP: best-effort sandbox settlement via the wellness-fund invoice hook.
    await this.subscriptions.handleInvoicePaid(invoice)

    ctx.session.flash('success', 'Payment received — your membership is now active.')
    return ctx.response.redirect('/portal/memberships')
  }
}
