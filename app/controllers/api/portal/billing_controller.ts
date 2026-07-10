import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Invoice from '#models/invoice'
import Patient from '#models/patient'
import Payment from '#models/payment'
import PatientBillingService from '#services/portal/patient_billing_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'

/**
 * Read-only billing surface for the patient app: fund/outstanding summary,
 * invoices, payments and printable receipts.
 *
 * Ported from App\Http\Controllers\Api\Portal\BillingController. Reuses the
 * portal PatientBillingService and reproduces the InvoiceResource /
 * InvoiceLineResource / PaymentResource JSON shapes inline.
 */
export default class BillingController {
  private readonly billingService = new PatientBillingService()
  private readonly dependentResolver = new PatientDependentResolver()

  async index(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)

    const recent = await this.billingService.recentPayments(patient)
    for (const payment of recent) {
      await payment.load('paymentReceipts')
    }

    return ctx.response.ok({
      outstanding_balance: await this.billingService.outstandingBalance(patient),
      recent_payments: recent.map((payment) => paymentToArray(payment)),
    })
  }

  async invoices(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const page = Number(ctx.request.input('page', 1)) || 1
    const paginator = await this.billingService.invoicesForPatient(patient, page)

    return ctx.response.ok(
      paginatedResource(ctx, paginator, (invoice: Invoice) => invoiceToArray(invoice))
    )
  }

  async showInvoice(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    let invoice = await Invoice.findOrFail(ctx.params.invoice ?? ctx.params.id)
    invoice = await this.billingService.invoiceForPatient(patient, invoice)

    return ctx.response.ok({ data: invoiceToArray(invoice) })
  }

  async payments(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const page = Number(ctx.request.input('page', 1)) || 1

    const paginator = await Payment.query()
      .where('patientId', patient.id)
      .preload('paymentReceipts')
      .orderBy('paidAt', 'desc')
      .paginate(page, 15)

    return ctx.response.ok(
      paginatedResource(ctx, paginator, (payment: Payment) => paymentToArray(payment))
    )
  }

  async receipt(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    let payment = await Payment.findOrFail(ctx.params.payment ?? ctx.params.id)
    payment = await this.billingService.paymentForPatient(patient, payment)

    const invoice = payment.invoice ?? null
    if (invoice) {
      await invoice.load('invoiceLines')
    }

    const receiptNumber = (payment.paymentReceipts ?? [])[0]?.receiptNumber ?? null

    return ctx.response.ok({
      receipt: {
        receipt_number: receiptNumber,
        payment: paymentToArray(payment),
        invoice: invoice ? invoiceToArray(invoice) : null,
        patient: {
          full_name: patient.fullName,
          patient_number: patient.patientId,
        },
        paid_at: iso(payment.paidAt),
        amount: String(payment.amount),
        payment_method: payment.paymentMethod,
      },
    })
  }

  // ── auth context (mirrors ResolvesApiPatient) ───────────────────────────────

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient_api').user as Patient
  }

  private async subjectPatient(ctx: HttpContext): Promise<Patient> {
    const guardian = this.guardian(ctx)
    const header = ctx.request.header('X-Portal-Viewing-Patient-Id')
    const parsedHeader = header !== undefined && header !== '' ? Number(header) : null
    const tokenId = guardian.currentAccessToken
      ? Number(guardian.currentAccessToken.identifier)
      : null

    return this.dependentResolver.viewingPatientForApi(guardian, parsedHeader, tokenId)
  }
}

// ── resource shapes ─────────────────────────────────────────────────────────

function invoiceToArray(invoice: Invoice): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    status: invoice.status,
    status_label: ucfirst(String(invoice.status)),
    issued_at: iso(invoice.issuedAt),
    due_at: invoice.dueAt ? invoice.dueAt.toISODate() : null,
    total_amount: String(invoice.totalAmount),
    balance_due: String(invoice.balanceDue),
    notes: invoice.notes,
  }

  if (isLoaded(invoice, 'invoiceLines')) {
    result.lines = (invoice.invoiceLines ?? []).map((line) => invoiceLineToArray(line))
  }
  if (isLoaded(invoice, 'payments')) {
    result.payments = (invoice.payments ?? []).map((payment) => paymentToArray(payment))
  }

  return result
}

function invoiceLineToArray(line: any): Record<string, unknown> {
  return {
    description: line.description,
    quantity: line.quantity,
    unit_price: String(line.unitPrice),
    amount: String(line.amount),
  }
}

function paymentToArray(payment: Payment): Record<string, unknown> {
  const receipt = (payment.paymentReceipts ?? [])[0] ?? null

  return {
    id: payment.id,
    amount: String(payment.amount),
    payment_method: payment.paymentMethod,
    paid_at: iso(payment.paidAt),
    invoice_id: payment.invoiceId,
    receipt: receipt ? { receipt_number: receipt.receiptNumber } : null,
  }
}

// ── local helpers ─────────────────────────────────────────────────────────────

function isLoaded(model: any, name: string): boolean {
  const preloaded = model?.$preloaded
  return Boolean(preloaded && name in preloaded)
}

function iso(dt: DateTime | null | undefined): string | null {
  return dt ? dt.toISO({ suppressMilliseconds: true }) : null
}

function ucfirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function paginatedResource<T>(
  ctx: HttpContext,
  paginator: any,
  map: (row: T) => Record<string, unknown>
): Record<string, unknown> {
  const path = ctx.request.completeUrl(false)
  const perPage = Number(paginator.perPage)
  const currentPage = Number(paginator.currentPage)
  const lastPage = Number(paginator.lastPage)
  const total = Number(paginator.total)
  const rows = paginator.all() as T[]
  const count = rows.length
  const from = total === 0 ? null : (currentPage - 1) * perPage + 1
  const to = total === 0 || from === null ? null : from + count - 1
  const pageUrl = (page: number) => `${path}?page=${page}`

  const metaLinks: Array<{ url: string | null; label: string; active: boolean }> = []
  metaLinks.push({
    url: currentPage > 1 ? pageUrl(currentPage - 1) : null,
    label: '&laquo; Previous',
    active: false,
  })
  for (let page = 1; page <= lastPage; page++) {
    metaLinks.push({ url: pageUrl(page), label: String(page), active: page === currentPage })
  }
  metaLinks.push({
    url: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    label: 'Next &raquo;',
    active: false,
  })

  return {
    data: rows.map(map),
    links: {
      first: pageUrl(1),
      last: pageUrl(lastPage),
      prev: currentPage > 1 ? pageUrl(currentPage - 1) : null,
      next: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    },
    meta: {
      current_page: currentPage,
      from,
      last_page: lastPage,
      links: metaLinks,
      path,
      per_page: perPage,
      to,
      total,
    },
  }
}
