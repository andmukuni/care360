import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Invoice from '#models/invoice'
import InvoiceLine from '#models/invoice_line'
import Patient from '#models/patient'
import Payment from '#models/payment'
import PaymentReceipt from '#models/payment_receipt'
import User from '#models/user'
import { num, randomAlnum, round2, trimPercent } from '#support/money_helpers'

/** A draft invoice line as supplied by callers (camelCase, mirrors Laravel array shape). */
export interface DraftLine {
  description: string
  quantity: number
  unitPrice: number
  category?: string
}

export default class InvoiceService {
  async createDraft(
    patient: Patient,
    encounterId: number | null,
    lines: DraftLine[],
    notes: string | null,
    _user: User | null = null,
    client?: TransactionClientContract
  ): Promise<Invoice> {
    const invoice = await Invoice.create(
      {
        patientId: patient.id,
        encounterId,
        invoiceNumber: this.generateInvoiceNumber(),
        status: 'draft',
        notes,
        totalAmount: 0,
        balanceDue: 0,
      },
      { client }
    )

    let total = 0
    for (const line of lines) {
      const amount = round2(num(line.quantity) * num(line.unitPrice))
      await InvoiceLine.create(
        {
          invoiceId: invoice.id,
          description: line.description,
          category: line.category ?? 'hospital',
          quantity: Math.trunc(num(line.quantity)),
          unitPrice: line.unitPrice,
          amount,
        },
        { client }
      )
      total += amount
    }

    invoice.totalAmount = total
    invoice.balanceDue = total
    await invoice.save()

    await invoice.load('invoiceLines')

    return invoice
  }

  /**
   * Apply a percentage discount to eligible subtotal as a negative line item.
   */
  async applyDiscount(
    invoice: Invoice,
    percent: number,
    label: string = 'Membership discount',
    eligibleSubtotal: number | null = null,
    client?: TransactionClientContract
  ): Promise<Invoice> {
    if (percent <= 0) {
      return invoice
    }

    const base = eligibleSubtotal ?? num(invoice.totalAmount)
    const discount = round2(base * (percent / 100))
    if (discount <= 0) {
      return invoice
    }

    await InvoiceLine.create(
      {
        invoiceId: invoice.id,
        description: label + ' (' + trimPercent(percent) + '%)',
        category: 'hospital',
        quantity: 1,
        unitPrice: -discount,
        amount: -discount,
      },
      { client }
    )

    const newTotal = Math.max(0, num(invoice.totalAmount) - discount)
    if (client) {
      invoice.useTransaction(client)
    }
    invoice.totalAmount = newTotal
    invoice.balanceDue = newTotal
    await invoice.save()

    await invoice.load('invoiceLines')

    return invoice
  }

  async issue(invoice: Invoice, client?: TransactionClientContract): Promise<Invoice> {
    if (client) {
      invoice.useTransaction(client)
    }
    invoice.status = 'issued'
    invoice.issuedAt = DateTime.now()
    invoice.dueAt = DateTime.now().plus({ days: 30 })
    await invoice.save()

    return invoice
  }

  async recordPayment(
    invoice: Invoice,
    amount: number,
    method: string,
    user: User | null = null,
    provider: string | null = null,
    providerReference: string | null = null,
    client?: TransactionClientContract
  ): Promise<Payment> {
    const payment = await Payment.create(
      {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount,
        paymentMethod: method,
        provider,
        providerReference,
        paidAt: DateTime.now(),
        recordedBy: user?.id ?? null,
      },
      { client }
    )

    const newBalance = Math.max(0, num(invoice.balanceDue) - amount)
    if (client) {
      invoice.useTransaction(client)
    }
    invoice.balanceDue = newBalance
    invoice.status = newBalance <= 0 ? 'paid' : 'partial'
    await invoice.save()

    await PaymentReceipt.create(
      {
        paymentId: payment.id,
        receiptNumber: 'RCP-' + randomAlnum(8).toUpperCase(),
        generatedAt: DateTime.now(),
      },
      { client }
    )

    await payment.load('paymentReceipts')

    return payment
  }

  private generateInvoiceNumber(): string {
    return 'INV-' + DateTime.now().toFormat('yyyyLLdd') + '-' + randomAlnum(6).toUpperCase()
  }
}
