import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import paymentsConfig from '#config/payments'
import MembershipPlan from '#models/membership_plan'
import Invoice from '#models/invoice'
import WellnessFundAccount from '#models/wellness_fund_account'
import WellnessFundLedgerEntry from '#models/wellness_fund_ledger_entry'
import CorporateMembershipLead from '#models/corporate_membership_lead'
import WellnessFundService from '#services/membership/wellness_fund_service'
import PaymentGatewayManager from '#services/payments/payment_gateway_manager'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import { subjectPatient } from './lab_controller.js'

const enrollValidator = vine.compile(
  vine.object({ amount: vine.number().min(1), payment: vine.enum(['manual', 'online']) })
)
const topUpValidator = enrollValidator
const corporateLeadValidator = vine.compile(
  vine.object({
    company_name: vine.string().maxLength(255),
    contact_name: vine.string().maxLength(255),
    job_title: vine.string().maxLength(255).nullable().optional(),
    email: vine.string().email().maxLength(255),
    phone: vine.string().maxLength(50).nullable().optional(),
    registration_number: vine.string().maxLength(120).nullable().optional(),
    employees_count: vine.number().nullable().optional(),
    partnership_option: vine.string().maxLength(120),
    estimated_deposit_or_volume: vine.number().nullable().optional(),
    message: vine.string().maxLength(5000).nullable().optional(),
  })
)

function planResource(plan: MembershipPlan): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    membership_type: plan.membershipType,
    tier: plan.tier,
    description: plan.description,
    minimum_deposit: String(plan.minimumDeposit),
    discount_percent: plan.discountPercent,
    perks: plan.perks,
  }
}

function subscriptionResource(account: WellnessFundAccount): Record<string, unknown> {
  return {
    id: account.id,
    status: account.status,
    balance: String(account.balance ?? 0),
    total_deposited: String(account.totalDeposited ?? 0),
    payment_provider: account.paymentProvider,
    enrolled_at: account.enrolledAt ? account.enrolledAt.toISO() : null,
    plan: account.membershipPlan ? planResource(account.membershipPlan) : null,
  }
}

/**
 * Wellness-fund / memberships (mobile). Ported from Api\Portal\MembershipController.
 *
 * PORT-GAP: Laravel used WellnessFundSettings/PaymentSettings + a
 * PatientSubscriptionResource and an `activeSubscription()` relation. Those are
 * mapped onto the Adonis WellnessFundAccount + WellnessFundService here with
 * best-effort JSON shapes. `recordPaymentAndActivate` maps to handleInvoicePaid.
 */
export default class MembershipController {
  private wellnessFund = new WellnessFundService()
  private gateways = new PaymentGatewayManager()
  private dependentResolver = new PatientDependentResolver()

  async index(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)

    const plans = await MembershipPlan.query()
      .where('membership_type', 'individual')
      .where('is_active', true)
      .orderBy('sort_order', 'asc')

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

    return ctx.response.ok({
      fund_name: 'Wellness Fund',
      corporate_signup_enabled: true,
      payments_sandbox: paymentsConfig.gateway === 'sandbox',
      plans: plans.map((p) => planResource(p)),
      current: current ? subscriptionResource(current) : null,
      history: history.map((a) => subscriptionResource(a)),
    })
  }

  async corporate(ctx: HttpContext) {
    // PORT-GAP: WellnessFundSettings partnership/benefit/terms content not ported.
    return ctx.response.ok({
      fund_name: 'Wellness Fund',
      partnership_options: [],
      benefits: [],
      terms: null,
      corporate_signup_enabled: true,
    })
  }

  async storeCorporateLead(ctx: HttpContext) {
    const v = await ctx.request.validateUsing(corporateLeadValidator)
    await CorporateMembershipLead.create({
      companyName: v.company_name,
      contactName: v.contact_name,
      jobTitle: v.job_title ?? null,
      email: v.email,
      phone: v.phone ?? null,
      registrationNumber: v.registration_number ?? null,
      employeesCount: v.employees_count ?? null,
      partnershipOption: v.partnership_option,
      estimatedDepositOrVolume: v.estimated_deposit_or_volume ?? null,
      message: v.message ?? null,
      status: 'new',
    })

    return ctx.response.created({
      message:
        'Your corporate wellness inquiry has been received. Our partnerships team will contact you.',
    })
  }

  async enroll(ctx: HttpContext) {
    const { amount, payment } = await ctx.request.validateUsing(enrollValidator)
    const plan = await MembershipPlan.findOrFail(ctx.params.plan)

    if (!plan.isActive || plan.membershipType !== 'individual') {
      return ctx.response.unprocessableEntity({ message: 'That tier is not available.' })
    }

    const patient = await subjectPatient(ctx, this.dependentResolver)
    const provider = payment === 'online' ? paymentsConfig.gateway : 'manual'

    try {
      const account = await this.wellnessFund.enroll(patient, plan, amount, { provider } as any)
      await account.load('membershipPlan')
      return ctx.response.created({
        message: `Enrollment started for ${plan.name}.`,
        subscription: subscriptionResource(account),
      })
    } catch (error) {
      return ctx.response.unprocessableEntity({
        message: (error as Error).message || 'We could not start your enrollment. Please try again.',
      })
    }
  }

  async subscribe(ctx: HttpContext) {
    const plan = await MembershipPlan.findOrFail(ctx.params.plan)
    if (ctx.request.input('amount') === undefined) {
      ctx.request.updateBody({ ...ctx.request.body(), amount: plan.minimumDeposit })
    }
    return this.enroll(ctx)
  }

  async topUp(ctx: HttpContext) {
    const { amount, payment } = await ctx.request.validateUsing(topUpValidator)
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const provider = payment === 'online' ? paymentsConfig.gateway : 'manual'

    try {
      const account = await this.wellnessFund.topUp(patient, amount, { provider } as any)
      await account.load('membershipPlan')
      return ctx.response.created({
        message: 'Top-up invoice created.',
        subscription: subscriptionResource(account),
      })
    } catch (error) {
      return ctx.response.unprocessableEntity({
        message: (error as Error).message || 'We could not create your top-up. Please try again.',
      })
    }
  }

  async ledger(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const account = await patient
      .related('wellnessFundAccounts')
      .query()
      .where('status', 'active')
      .orderBy('id', 'desc')
      .first()

    const page = Number(ctx.request.input('page', 1)) || 1
    const entries = await WellnessFundLedgerEntry.query()
      .where('patient_id', patient.id)
      .orderBy('created_at', 'desc')
      .paginate(page, 20)

    return ctx.response.ok({
      balance: String(account?.balance ?? 0),
      entries: entries.all().map((e) => ({
        id: e.id,
        type: e.type,
        amount: String(e.amount),
        balance_after: String(e.balanceAfter),
        description: e.description,
        created_at: e.createdAt ? e.createdAt.toISO() : null,
      })),
      meta: {
        current_page: entries.currentPage,
        last_page: entries.lastPage,
        total: entries.total,
      },
    })
  }

  async cancelPreview(ctx: HttpContext) {
    const account = await WellnessFundAccount.findOrFail(ctx.params.subscription)
    if (account.status !== 'active') {
      return ctx.response.unprocessableEntity({ message: 'Only active memberships can be cancelled.' })
    }
    return ctx.response.ok(await this.wellnessFund.cancellationPreview(account))
  }

  async cancel(ctx: HttpContext) {
    const account = await WellnessFundAccount.findOrFail(ctx.params.subscription)
    if (account.status !== 'active') {
      return ctx.response.unprocessableEntity({ message: 'Only active memberships can be cancelled.' })
    }

    try {
      const updated = await this.wellnessFund.cancel(account)
      await updated.load('membershipPlan')
      return ctx.response.ok({
        message: 'Wellness fund membership cancelled. Your refund has been processed.',
        subscription: subscriptionResource(updated),
      })
    } catch (error) {
      return ctx.response.unprocessableEntity({
        message:
          (error as Error).message ||
          'We could not process your withdrawal. Please try again or contact support.',
      })
    }
  }

  async checkout(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const invoice = await Invoice.findOrFail(ctx.params.invoice)
    if (Number(invoice.patientId) !== Number(patient.id)) {
      return ctx.response.forbidden({ message: 'Forbidden' })
    }

    const checkout = this.gateways.gateway().startCheckout(invoice)

    return ctx.response.ok({
      redirect_url: checkout.redirectUrl,
      reference: checkout.reference,
      invoice_id: invoice.id,
    })
  }

  async sandboxConfirm(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const invoice = await Invoice.findOrFail(ctx.params.invoice)
    if (Number(invoice.patientId) !== Number(patient.id)) {
      return ctx.response.forbidden({ message: 'Forbidden' })
    }
    if (paymentsConfig.gateway !== 'sandbox') {
      return ctx.response.notFound({ message: 'Not found.' })
    }

    // PORT-GAP: best-effort settlement via the wellness-fund invoice hook.
    await this.wellnessFund.handleInvoicePaid(invoice)

    return ctx.response.ok({ message: 'Payment received — your wellness fund is now active.' })
  }
}
