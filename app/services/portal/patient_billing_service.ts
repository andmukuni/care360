import Invoice from '#models/invoice'
import InvoiceLine from '#models/invoice_line'
import MembershipPlan from '#models/membership_plan'
import Patient from '#models/patient'
import Payment from '#models/payment'
import WellnessFundAccount from '#models/wellness_fund_account'
import db from '@adonisjs/lucid/services/db'
import WellnessFundService from '#services/membership/wellness_fund_service'
import PatientAuditService from '#services/portal/patient_audit_service'
import { abortIf, abortUnless } from '#services/portal/portal_errors'
import WellnessFundSettings from '#support/wellness_fund_settings'
import { num, numberFormat } from '#support/money_helpers'

/** Laravel morph classes stored on audit rows (matches legacy data). */
const INVOICE_MORPH = 'App\\Models\\Invoice'
const PAYMENT_MORPH = 'App\\Models\\Payment'

export interface BillingCardSummary {
  fund_balance: string
  outstanding_balance: string
  total_saved: string
  total_paid: string
  membership_plan: string | null
  membership_plan_tier: number | null
  membership_discount_percent: number
}

export interface PatientMembershipSummary {
  membership_plan: string | null
  membership_plan_tier: number | null
  membership_discount_percent: number
  fund_balance: string
  outstanding_balance: string
}

/**
 * Patient-portal billing read model: wellness fund balances, invoices, payments.
 *
 * Ported from App\Services\Portal\PatientBillingService.
 *
 * PORT-GAP: `page` param added to invoicesForPatient because Lucid `.paginate()`
 * requires an explicit page.
 */
export default class PatientBillingService {
  constructor(
    private readonly auditService: PatientAuditService = new PatientAuditService(),
    private readonly wellnessFund: WellnessFundService = new WellnessFundService()
  ) {}

  /**
   * Wellness fund overshoot: negative when hospital services exceed the deposit.
   */
  async outstandingBalance(patient: Patient): Promise<string> {
    return this.fundDue(patient)
  }

  async fundBalance(patient: Patient): Promise<string> {
    return this.formatMoney(Math.max(0, await this.wellnessFundRawBalance(patient)))
  }

  async fundDue(patient: Patient): Promise<string> {
    return this.formatMoney(Math.min(0, await this.wellnessFundRawBalance(patient)))
  }

  async invoiceBalanceDue(patient: Patient): Promise<string> {
    const result = await Invoice.query()
      .where('patientId', patient.id)
      .whereIn('status', ['issued', 'partial'])
      .sum('balance_due as total')

    return this.formatMoney(num(result[0].$extras.total))
  }

  private async wellnessFundRawBalance(patient: Patient): Promise<number> {
    const account =
      (await WellnessFundAccount.query()
        .where('patientId', patient.id)
        .whereIn('status', ['active', 'suspended', 'pending'])
        .orderBy('id', 'desc')
        .first()) ??
      (await WellnessFundAccount.query()
        .where('patientId', patient.id)
        .where('balance', '<', 0)
        .orderBy('id', 'desc')
        .first())

    return num(account?.balance ?? 0)
  }

  private formatMoney(amount: number): string {
    return numberFormat(amount, 2, '.', '')
  }

  async invoicesForPatient(patient: Patient, page: number = 1) {
    return Invoice.query()
      .where('patientId', patient.id)
      .whereIn('status', ['issued', 'paid', 'partial'])
      .preload('invoiceLines')
      .orderBy('issuedAt', 'desc')
      .paginate(page, 15)
  }

  async invoiceForPatient(patient: Patient, invoice: Invoice): Promise<Invoice> {
    abortIf(Number(invoice.patientId) !== Number(patient.id), 403)
    abortUnless(this.isVisibleToPatient(invoice), 403)

    await this.auditService.record(patient, 'billing.invoice_viewed', INVOICE_MORPH, invoice.id)

    await invoice.load('invoiceLines')
    await invoice.load('payments', (query) => {
      query.preload('paymentReceipts')
    })

    return invoice
  }

  async paymentForPatient(patient: Patient, payment: Payment): Promise<Payment> {
    abortIf(Number(payment.patientId) !== Number(patient.id), 403)

    await this.auditService.record(patient, 'billing.payment_viewed', PAYMENT_MORPH, payment.id)

    await payment.load('invoice')
    await payment.load('paymentReceipts')

    return payment
  }

  async recentPayments(patient: Patient, limit: number = 5): Promise<Payment[]> {
    return Payment.query().where('patientId', patient.id).orderBy('paidAt', 'desc').limit(limit)
  }

  async totalPaid(patient: Patient): Promise<string> {
    const result = await Payment.query().where('patientId', patient.id).sum('amount as total')

    return String(num(result[0].$extras.total))
  }

  /**
   * Sum of membership discount line items (negative amounts) across the patient's invoices.
   */
  async totalMembershipSavings(patient: Patient): Promise<string> {
    const result = await InvoiceLine.query()
      .whereHas('invoice', (query) => query.where('patientId', patient.id))
      .where('amount', '<', 0)
      .sum('amount as total')

    return String(Math.abs(num(result[0].$extras.total)))
  }

  async cardSummary(patient: Patient): Promise<BillingCardSummary> {
    const account = await WellnessFundAccount.query()
      .where('patientId', patient.id)
      .where('status', 'active')
      .preload('membershipPlan')
      .orderBy('id', 'desc')
      .first()

    const effective = await this.wellnessFund.resolveEffectivePlan(patient)

    return {
      fund_balance: await this.fundBalance(patient),
      outstanding_balance: await this.fundDue(patient),
      total_saved: await this.totalMembershipSavings(patient),
      total_paid: await this.totalPaid(patient),
      membership_plan: effective?.name ?? account?.membershipPlan?.name ?? null,
      membership_plan_tier: effective?.tier ?? account?.membershipPlan?.tier ?? null,
      membership_discount_percent: await this.wellnessFund.activeDiscountPercent(patient),
    }
  }

  async membershipSummariesForPatientIds(
    patientIds: number[]
  ): Promise<Record<number, PatientMembershipSummary>> {
    if (patientIds.length === 0) {
      return {}
    }

    const uniqueIds = [...new Set(patientIds)].slice(0, 20)

    const accounts = await WellnessFundAccount.query()
      .whereIn('patientId', uniqueIds)
      .where('status', 'active')
      .preload('membershipPlan')
      .orderBy('id', 'desc')

    const accountByPatientId = new Map<number, WellnessFundAccount>()
    for (const account of accounts) {
      if (!accountByPatientId.has(account.patientId)) {
        accountByPatientId.set(account.patientId, account)
      }
    }

    const plans = await MembershipPlan.query()
      .where('membershipType', 'individual')
      .where('isActive', true)
      .orderBy('sortOrder', 'asc')
      .orderBy('tier', 'asc')

    const plansByTier = new Map(plans.map((plan) => [plan.tier, plan]))
    const minBalanceByTier = new Map<number, number>()
    for (const plan of plans) {
      if (plan.tier <= 1) {
        minBalanceByTier.set(plan.tier, num(plan.minBalance ?? 0))
      } else {
        const previous = plansByTier.get(plan.tier - 1)
        minBalanceByTier.set(
          plan.tier,
          previous ? num(previous.minimumDeposit) : num(plan.minBalance ?? 0)
        )
      }
    }

    const sortedPlans = [...plans].sort((a, b) => b.tier - a.tier)

    const suspendDiscountOnOutstanding = await WellnessFundSettings.suspendDiscountOnOutstanding()
    const outstandingPatientIds = new Set<number>()
    if (suspendDiscountOnOutstanding) {
      const outstandingRows = await db
        .from('invoices')
        .whereIn('patient_id', uniqueIds)
        .whereIn('status', ['issued', 'partial'])
        .where('balance_due', '>', 0)
        .groupBy('patient_id')
        .select('patient_id')

      for (const row of outstandingRows) {
        outstandingPatientIds.add(Number(row.patient_id))
      }
    }

    const summaries: Record<number, PatientMembershipSummary> = {}

    for (const patientId of uniqueIds) {
      const account = accountByPatientId.get(patientId)
      if (!account) {
        continue
      }

      const balance = num(account.balance)
      let effectivePlan: MembershipPlan | null = null

      if (balance > 0) {
        for (const plan of sortedPlans) {
          if (balance >= (minBalanceByTier.get(plan.tier) ?? 0)) {
            effectivePlan = plan
            break
          }
        }
      }

      let discountPercent = 0
      if (account.status !== 'suspended' && effectivePlan) {
        if (!suspendDiscountOnOutstanding || !outstandingPatientIds.has(patientId)) {
          discountPercent = num(effectivePlan.discountPercent)
        }
      }

      summaries[patientId] = {
        membership_plan: effectivePlan?.name ?? account.membershipPlan?.name ?? null,
        membership_plan_tier: effectivePlan?.tier ?? account.membershipPlan?.tier ?? null,
        membership_discount_percent: discountPercent,
        fund_balance: this.formatMoney(Math.max(0, balance)),
        outstanding_balance: this.formatMoney(Math.min(0, balance)),
      }
    }

    return summaries
  }

  async membershipSummariesForPatients(
    patients: Patient[]
  ): Promise<Record<number, PatientMembershipSummary>> {
    return this.membershipSummariesForPatientIds(patients.map((patient) => patient.id))
  }

  /** Inlined from Laravel Invoice::isVisibleToPatient(). */
  private isVisibleToPatient(invoice: Invoice): boolean {
    return ['issued', 'paid', 'partial'].includes(invoice.status)
  }
}
