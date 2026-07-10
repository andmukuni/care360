import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Invoice from '#models/invoice'
import MembershipPlan from '#models/membership_plan'
import Patient from '#models/patient'
import Payment from '#models/payment'
import User from '#models/user'
import WellnessFundAccount from '#models/wellness_fund_account'
import InvoiceService from '#services/billing/invoice_service'
import WellnessFundLedger from '#services/membership/wellness_fund_ledger'
import PaymentSettings from '#support/payment_settings'
import WellnessFundSettings from '#support/wellness_fund_settings'
import { num, numberFormat, round2 } from '#support/money_helpers'

export interface EnrollOptions {
  provider?: string
  enrolledBy?: User | null
}

/** Morph type stored on ledger reference_type for invoices (matches legacy data). */
const INVOICE_REFERENCE_TYPE = 'App\\Models\\Invoice'

export interface CancellationPreview {
  can_cancel: boolean
  balance: string
  admin_fee_percent: string
  admin_fee_amount: string
  refund_amount: string
  min_months_before_refund: number
  eligible_at: string | null
  sandbox_simulated: boolean
}

export default class WellnessFundService {
  constructor(
    private readonly invoiceService: InvoiceService = new InvoiceService(),
    private readonly ledger: WellnessFundLedger = new WellnessFundLedger()
  ) {}

  async enroll(
    patient: Patient,
    plan: MembershipPlan,
    amount: number,
    opts: EnrollOptions = {}
  ): Promise<WellnessFundAccount> {
    if (plan.membershipType !== 'individual') {
      throw new Error('Only individual tiers can be enrolled online.')
    }

    const minimum = num(plan.minimumDeposit)
    if (amount < minimum) {
      throw new Error(`Minimum deposit for ${plan.name} is ZMW ${numberFormat(minimum, 2)}.`)
    }

    return db.transaction(async (trx) => {
      await this.consolidateDuplicateActiveAccounts(patient, null, trx)

      const existing = await this.activeSubscription(patient.id, trx)
      if (existing && this.isActive(existing)) {
        throw new Error('You already have an active wellness fund account. Use top-up instead.')
      }

      const account = await WellnessFundAccount.create(
        {
          patientId: patient.id,
          membershipPlanId: plan.id,
          balance: 0,
          totalDeposited: 0,
          status: 'pending',
          paymentProvider: opts.provider ?? 'manual',
          enrolledBy: opts.enrolledBy?.id ?? null,
        },
        { client: trx }
      )

      await this.createDepositInvoice(account, plan, patient, amount, 'deposit', trx)

      await account.refresh()
      await account.load('membershipPlan')

      return account
    })
  }

  async topUp(patient: Patient, amount: number, _opts: EnrollOptions = {}): Promise<WellnessFundAccount> {
    if (amount <= 0) {
      throw new Error('Top-up amount must be greater than zero.')
    }

    let account = await this.activeSubscription(patient.id)
    if (!account) {
      account = await WellnessFundAccount.query()
        .where('patientId', patient.id)
        .where('status', 'pending')
        .orderBy('id', 'desc')
        .first()
    }

    if (!account) {
      throw new Error('No wellness fund account found. Enroll in a tier first.')
    }

    await account.load('membershipPlan')
    let plan: MembershipPlan | null = account.membershipPlan
    if (!plan) {
      plan = await MembershipPlan.query()
        .where('membershipType', 'individual')
        .orderBy('sortOrder', 'asc')
        .orderBy('tier', 'asc')
        .first()
    }
    if (!plan) {
      throw new Error('No membership plan configured.')
    }

    await this.createDepositInvoice(account, plan, patient, amount, 'top_up')

    await account.refresh()
    await account.load('membershipPlan')

    return account
  }

  async resolveEffectivePlan(patient: Patient): Promise<MembershipPlan | null> {
    const account = await this.activeSubscription(patient.id)
    if (!account || account.status !== 'active') {
      return null
    }

    const balance = num(account.balance)
    if (balance <= 0) {
      return null
    }

    const plans = await MembershipPlan.query()
      .where('membershipType', 'individual')
      .where('isActive', true)
      .orderBy('sortOrder', 'asc')
      .orderBy('tier', 'asc')

    plans.sort((a, b) => b.tier - a.tier)

    for (const plan of plans) {
      if (balance >= (await this.effectiveMinBalance(plan))) {
        return plan
      }
    }

    return null
  }

  async activeDiscountPercent(patient: Patient): Promise<number> {
    if ((await WellnessFundSettings.suspendDiscountOnOutstanding()) && (await this.hasOutstandingInvoices(patient))) {
      return 0
    }

    const account = await this.activeSubscription(patient.id)
    if (!account || account.status === 'suspended') {
      return 0
    }

    const plan = await this.resolveEffectivePlan(patient)

    return plan ? num(plan.discountPercent) : 0
  }

  async chargeHospitalInvoice(invoice: Invoice, user: User | null = null): Promise<void> {
    await this.reconcileHospitalInvoice(invoice, user)
  }

  /**
   * Debit the wellness fund for hospital / encounter services and settle the invoice against the deposit.
   * Overshoot beyond the deposit is stored as a negative fund balance (shown as DUE on the patient card).
   */
  async reconcileHospitalInvoice(invoice: Invoice, user: User | null = null): Promise<void> {
    if (this.parseFundInvoiceNotes(invoice.notes)) {
      return
    }

    const account = await WellnessFundAccount.query()
      .where('patientId', invoice.patientId)
      .whereIn('status', ['active', 'suspended'])
      .orderBy('id', 'desc')
      .first()

    if (!account) {
      return
    }

    const amount = num(invoice.totalAmount)
    if (amount <= 0) {
      return
    }

    await this.ledger.debit(
      account,
      amount,
      'hospital_charge',
      INVOICE_REFERENCE_TYPE,
      invoice.id,
      'Hospital services: ' + invoice.invoiceNumber,
      user
    )

    invoice.subscriptionId = account.id
    invoice.balanceDue = 0
    invoice.status = 'paid'
    await invoice.save()
  }

  async applyDiscountToInvoice(invoice: Invoice): Promise<Invoice> {
    await invoice.load('patient')
    const percent = await this.activeDiscountPercent(invoice.patient)
    if (percent <= 0) {
      return invoice
    }

    const eligibleTotal = await this.eligibleLineTotal(invoice)
    if (eligibleTotal <= 0) {
      return invoice
    }

    const discount = round2(eligibleTotal * (percent / 100))
    if (discount <= 0) {
      return invoice
    }

    return this.invoiceService.applyDiscount(
      invoice,
      percent,
      (await WellnessFundSettings.fundName()) + ' discount',
      eligibleTotal
    )
  }

  async cancellationPreview(account: WellnessFundAccount): Promise<CancellationPreview> {
    const enrolledAt = account.enrolledAt ?? account.startedAt ?? account.createdAt
    const minMonths = await WellnessFundSettings.minMonthsBeforeRefund()
    const eligibleAt = enrolledAt ? enrolledAt.plus({ months: minMonths }) : null
    let canCancel = !eligibleAt || eligibleAt <= DateTime.now()
    const sandboxSimulated = (await PaymentSettings.gateway()) === 'sandbox'

    if (sandboxSimulated) {
      canCancel = true
    }

    const balance = Math.max(0, num(account.balance))
    const feePercent = await WellnessFundSettings.refundAdminFeePercent()
    const feeAmount = round2(balance * (feePercent / 100))
    const refundAmount = round2(balance - feeAmount)

    return {
      can_cancel: canCancel,
      balance: numberFormat(balance, 2, '.', ''),
      admin_fee_percent: String(feePercent),
      admin_fee_amount: numberFormat(feeAmount, 2, '.', ''),
      refund_amount: numberFormat(refundAmount, 2, '.', ''),
      min_months_before_refund: minMonths,
      eligible_at: eligibleAt ? eligibleAt.toISO() : null,
      sandbox_simulated: sandboxSimulated,
    }
  }

  async requestCancellation(account: WellnessFundAccount): Promise<WellnessFundAccount> {
    const preview = await this.cancellationPreview(account)

    if (!preview.can_cancel) {
      throw new Error(
        'Cancellation is available after ' + preview.min_months_before_refund + ' months of membership.'
      )
    }

    const sandbox = preview.sandbox_simulated

    return db.transaction(async (trx) => {
      const locked = await WellnessFundAccount.query({ client: trx })
        .where('id', account.id)
        .forUpdate()
        .firstOrFail()

      locked.cancelRequestedAt = DateTime.now()
      locked.status = 'cancelled'
      locked.cancelledAt = DateTime.now()

      const balance = num(preview.balance)
      if (sandbox || balance <= 0) {
        locked.balance = 0
      }

      await locked.save()

      // Sandbox: skip ledger writes entirely — cancel must always succeed for testing.
      if (sandbox) {
        await locked.load('membershipPlan')
        return locked
      }

      if (balance > 0) {
        const feePercent = num(preview.admin_fee_percent)

        await this.ledger.debit(
          locked,
          balance,
          'refund',
          null,
          null,
          `Refund processed (${feePercent}% admin fee: ZMW ${numberFormat(num(preview.admin_fee_amount), 2)})`,
          null,
          {},
          trx
        )
      }

      await locked.refresh()
      await locked.load('membershipPlan')
      return locked
    })
  }

  async cancel(account: WellnessFundAccount): Promise<WellnessFundAccount> {
    return this.requestCancellation(account)
  }

  async handleInvoicePaid(invoice: Invoice): Promise<void> {
    const meta = this.parseFundInvoiceNotes(invoice.notes)
    if (!meta) {
      return
    }

    const account = await WellnessFundAccount.find(Number(meta.account_id ?? 0))
    if (!account) {
      return
    }

    const amount = num(meta.amount ?? invoice.totalAmount)
    const type = (meta.kind ?? 'deposit') === 'top_up' ? 'top_up' : 'deposit'

    await this.ledger.credit(
      account,
      amount,
      type,
      INVOICE_REFERENCE_TYPE,
      invoice.id,
      this.ucfirst(type.replace(/_/g, ' ')) + ' via invoice ' + invoice.invoiceNumber
    )

    await account.load('patient')
    const effective = await this.resolveEffectivePlan(account.patient)
    if (effective) {
      account.membershipPlanId = effective.id
      await account.save()
    }

    if (account.status === 'pending') {
      await this.consolidateDuplicateActiveAccounts(account.patient, account.id)

      account.status = 'active'
      account.startedAt = account.startedAt ?? DateTime.now()
      account.enrolledAt = account.enrolledAt ?? DateTime.now()
      await account.save()
    }
  }

  /**
   * Keep one active wellness fund account per patient; cancel stale duplicates.
   */
  async consolidateDuplicateActiveAccounts(
    patient: Patient,
    keepAccountId: number | null = null,
    client?: TransactionClientContract
  ): Promise<number> {
    const actives = await WellnessFundAccount.query({ client })
      .where('patientId', patient.id)
      .where('status', 'active')
      .orderBy('id', 'desc')

    if (actives.length <= 1) {
      return 0
    }

    let keep = keepAccountId ? actives.find((a) => a.id === keepAccountId) : null
    keep = keep ?? actives[0]

    let cancelled = 0

    for (const account of actives) {
      if (account.id === keep.id) {
        continue
      }

      account.status = 'cancelled'
      account.cancelRequestedAt = account.cancelRequestedAt ?? DateTime.now()
      account.cancelledAt = account.cancelledAt ?? DateTime.now()
      await account.save()
      cancelled++
    }

    return cancelled
  }

  async recordPaymentAndActivate(
    invoice: Invoice,
    amount: number,
    method: string,
    user: User | null = null,
    provider: string | null = null,
    providerReference: string | null = null
  ): Promise<Payment> {
    const payment = await this.invoiceService.recordPayment(invoice, amount, method, user, provider, providerReference)
    await invoice.refresh()
    await this.handleInvoicePaid(invoice)

    return payment
  }

  private async createDepositInvoice(
    account: WellnessFundAccount,
    plan: MembershipPlan,
    patient: Patient,
    amount: number,
    kind: string,
    client?: TransactionClientContract
  ): Promise<Invoice> {
    const label =
      kind === 'top_up'
        ? `${await WellnessFundSettings.fundName()} top-up`
        : `${await WellnessFundSettings.fundName()} ${plan.name} enrollment deposit`

    const notes = JSON.stringify({
      wellness_fund: true,
      kind,
      account_id: account.id,
      plan_id: plan.id,
      amount,
    })

    const invoice = await this.invoiceService.createDraft(
      patient,
      null,
      [{ description: label, quantity: 1, unitPrice: amount, category: 'hospital' }],
      notes,
      null,
      client
    )

    if (client) {
      invoice.useTransaction(client)
    }
    invoice.subscriptionId = account.id
    await invoice.save()

    return this.invoiceService.issue(invoice, client)
  }

  private async eligibleLineTotal(invoice: Invoice): Promise<number> {
    await invoice.load('invoiceLines')
    const excludePharmacy = await WellnessFundSettings.excludePharmacy()
    const excludeOutsourced = await WellnessFundSettings.excludeOutsourced()

    return round2(
      invoice.invoiceLines.reduce((total, line) => {
        if (num(line.amount) <= 0) {
          return total
        }
        const category = line.category ?? 'hospital'
        if (excludePharmacy && category === 'pharmacy') {
          return total
        }
        if (excludeOutsourced && category === 'outsourced') {
          return total
        }
        if (category === 'excluded') {
          return total
        }

        return total + num(line.amount)
      }, 0)
    )
  }

  private async hasOutstandingInvoices(patient: Patient): Promise<boolean> {
    const outstanding = await Invoice.query()
      .where('patientId', patient.id)
      .whereIn('status', ['issued', 'partial'])
      .where('balanceDue', '>', 0)
      .first()

    return outstanding !== null
  }

  private async activeSubscription(
    patientId: number,
    client?: TransactionClientContract
  ): Promise<WellnessFundAccount | null> {
    return WellnessFundAccount.query({ client })
      .where('patientId', patientId)
      .where('status', 'active')
      .orderBy('id', 'desc')
      .first()
  }

  private isActive(account: WellnessFundAccount): boolean {
    return account.status === 'active' && num(account.balance) > 0
  }

  /** Minimum balance required to keep this tier's discount active. */
  private async effectiveMinBalance(plan: MembershipPlan): Promise<number> {
    if (plan.tier <= 1) {
      return num(plan.minBalance ?? 0)
    }

    const previous = await MembershipPlan.query()
      .where('membershipType', 'individual')
      .where('tier', plan.tier - 1)
      .first()

    return previous ? num(previous.minimumDeposit) : num(plan.minBalance ?? 0)
  }

  private parseFundInvoiceNotes(notes: string | null): Record<string, any> | null {
    if (notes === null || notes === '') {
      return null
    }

    try {
      const decoded = JSON.parse(notes)
      return decoded && typeof decoded === 'object' && decoded.wellness_fund ? decoded : null
    } catch {
      return null
    }
  }

  private ucfirst(value: string): string {
    return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
  }
}
