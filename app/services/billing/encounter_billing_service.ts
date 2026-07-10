import Encounter from '#models/encounter'
import Invoice from '#models/invoice'
import User from '#models/user'
import WellnessFundAccount from '#models/wellness_fund_account'
import InvoiceService from '#services/billing/invoice_service'
import RateCardPricingService from '#services/billing/rate_card_pricing_service'
import WellnessFundService from '#services/membership/wellness_fund_service'
import WellnessFundSettings from '#support/wellness_fund_settings'
import { num, round2 } from '#support/money_helpers'

export interface PreviewLine {
  description: string
  quantity: number
  unitPrice: number
  category: string
  lineTotal: number
}

export interface EncounterBillingOptions {
  includeTreatmentRoomFee?: boolean
}

export interface EncounterBillingPreview {
  lines: PreviewLine[]
  subtotal: number
  discountPercent: number
  estimatedDiscount: number
  estimatedTotal: number
  fundBalance: number
  estimatedFundAfter: number
  estimatedDue: number
  hasFundAccount: boolean
  effectiveTier: string | null
}

export default class EncounterBillingService {
  constructor(
    private readonly invoiceService: InvoiceService = new InvoiceService(),
    private readonly wellnessFund: WellnessFundService = new WellnessFundService(),
    private readonly rateCard: RateCardPricingService = new RateCardPricingService()
  ) {}

  async preview(encounter: Encounter, opts: EncounterBillingOptions = {}): Promise<EncounterBillingPreview> {
    await encounter.load('patient')

    const lines = await this.buildLineItems(encounter, opts)
    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0))
    const discountPercent = await this.wellnessFund.activeDiscountPercent(encounter.patient)
    const eligibleTotal = await this.eligibleSubtotal(lines)
    const estimatedDiscount = discountPercent > 0 ? round2(eligibleTotal * (discountPercent / 100)) : 0
    const estimatedTotal = round2(Math.max(0, subtotal - estimatedDiscount))

    const account = await this.activeSubscription(encounter.patientId)
    const fundBalance = num(account?.balance ?? 0)
    const estimatedFundAfter = account ? round2(fundBalance - estimatedTotal) : 0

    const effectivePlan = await this.wellnessFund.resolveEffectivePlan(encounter.patient)

    return {
      lines,
      subtotal,
      discountPercent,
      estimatedDiscount,
      estimatedTotal,
      fundBalance,
      estimatedFundAfter,
      estimatedDue: Math.min(0, estimatedFundAfter),
      hasFundAccount: account !== null,
      effectiveTier: effectivePlan?.name ?? null,
    }
  }

  /**
   * Issue an encounter invoice and reconcile against the patient's wellness fund when enrolled.
   */
  async billEncounter(
    encounter: Encounter,
    user: User | null = null,
    opts: EncounterBillingOptions = {}
  ): Promise<Invoice> {
    const existing = await this.existingInvoice(encounter)
    if (existing) {
      await existing.load('invoiceLines')
      return existing
    }

    await encounter.load('patient')
    const lines = await this.buildLineItems(encounter, opts)

    if (lines.length === 0) {
      throw new Error('No billable services found for this encounter.')
    }

    const draftLines = lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      category: line.category,
    }))

    const notes = JSON.stringify({
      encounter_billing: true,
      encounter_id: encounter.id,
      encounter_number: encounter.encounterNumber,
    })

    let invoice = await this.invoiceService.createDraft(encounter.patient, encounter.id, draftLines, notes, user)

    const account = await this.activeSubscription(encounter.patientId)
    if (account) {
      invoice.subscriptionId = account.id
      await invoice.save()
    }

    await invoice.load('invoiceLines')
    invoice = await this.wellnessFund.applyDiscountToInvoice(invoice)
    await invoice.load('invoiceLines')
    invoice = await this.invoiceService.issue(invoice)
    await invoice.load('invoiceLines')
    await this.wellnessFund.reconcileHospitalInvoice(invoice, user)

    await invoice.refresh()
    await invoice.load('invoiceLines')

    return invoice
  }

  async existingInvoice(encounter: Encounter): Promise<Invoice | null> {
    return Invoice.query()
      .where('encounterId', encounter.id)
      .whereIn('status', ['issued', 'paid', 'partial'])
      .orderBy('id', 'desc')
      .first()
  }

  async buildLineItems(encounter: Encounter, opts: EncounterBillingOptions = {}): Promise<PreviewLine[]> {
    await encounter.load('labRequests', (query) => query.preload('labRequestItems'))
    await encounter.load('pharmacyDispenses', (query) => query.preload('pharmacyDispenseItems'))

    const lines: PreviewLine[] = []

    const consultFee = await this.rateCard.consultationFee(encounter.visitType)
    if (consultFee > 0) {
      const visitLabel =
        encounter.visitType !== null && encounter.visitType !== ''
          ? this.ucfirst(String(encounter.visitType).replace(/_/g, ' '))
          : 'Consultation'

      lines.push(this.line(`${visitLabel} — ${encounter.encounterNumber}`, 1, consultFee, 'hospital'))
    }

    // Laravel used a single labRequest (hasOne); mirror with the first request's items.
    const labRequest = encounter.labRequests?.[0] ?? null
    for (const item of labRequest?.labRequestItems ?? []) {
      const labFee = await this.rateCard.labTestFee(item.testName, null)
      if (labFee <= 0) {
        continue
      }

      lines.push(this.line('Lab: ' + item.testName, 1, labFee, 'hospital'))
    }

    // Laravel used the latest dispense (latestOfMany); mirror with the newest by id.
    const dispense =
      (encounter.pharmacyDispenses ?? []).slice().sort((a, b) => b.id - a.id)[0] ?? null
    for (const item of dispense?.pharmacyDispenseItems ?? []) {
      const pharmFee = await this.rateCard.medicationFee(item.drugName, item.medicationId)
      if (pharmFee <= 0) {
        continue
      }

      const qty = Math.max(1, Math.trunc(num(item.quantityDispensed)))
      lines.push(this.line('Pharmacy: ' + item.drugName, qty, pharmFee, 'pharmacy'))
    }

    if (opts.includeTreatmentRoomFee) {
      const treatmentFee = await this.rateCard.treatmentRoomFee()
      if (treatmentFee > 0) {
        lines.push(this.line('Treatment room services — ' + encounter.encounterNumber, 1, treatmentFee, 'hospital'))
      }
    }

    return lines
  }

  private async eligibleSubtotal(lines: PreviewLine[]): Promise<number> {
    const excludePharmacy = await WellnessFundSettings.excludePharmacy()
    const excludeOutsourced = await WellnessFundSettings.excludeOutsourced()

    return round2(
      lines.reduce((total, line) => {
        if (line.lineTotal <= 0) {
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

        return total + line.lineTotal
      }, 0)
    )
  }

  private line(description: string, quantity: number, unitPrice: number, category: string): PreviewLine {
    return {
      description,
      quantity,
      unitPrice,
      category,
      lineTotal: round2(quantity * unitPrice),
    }
  }

  private async activeSubscription(patientId: number): Promise<WellnessFundAccount | null> {
    return WellnessFundAccount.query()
      .where('patientId', patientId)
      .where('status', 'active')
      .orderBy('id', 'desc')
      .first()
  }

  private ucfirst(value: string): string {
    return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
  }
}
