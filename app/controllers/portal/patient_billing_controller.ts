import type { HttpContext } from '@adonisjs/core/http'
import Invoice from '#models/invoice'
import Payment from '#models/payment'
import PortalController from '#controllers/portal/portal_controller'
import PatientBillingService from '#services/portal/patient_billing_service'

/**
 * Patient billing. Ported from Portal\PatientBillingController.
 */
export default class PatientBillingController extends PortalController {
  private billingService = new PatientBillingService()

  async index(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)

    return ctx.inertia.render('portal/billing/index', {
      patient,
      invoices: (await this.billingService.invoicesForPatient(patient, ctx.request.input('page', 1))).toJSON(),
      outstandingBalance: await this.billingService.outstandingBalance(patient),
      recentPayments: await this.billingService.recentPayments(patient),
    })
  }

  async showInvoice(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const invoice = await Invoice.findOrFail(ctx.params.invoice)
    const scoped = await this.billingService.invoiceForPatient(patient, invoice)

    return ctx.inertia.render('portal/billing/show', { patient, invoice: scoped })
  }

  /**
   * Receipt download. PORT-GAP: Laravel rendered a Blade receipt; here we stream
   * a minimal HTML receipt document.
   */
  async downloadReceipt(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const payment = await Payment.findOrFail(ctx.params.payment)
    const scoped = await this.billingService.paymentForPatient(patient, payment)
    await scoped.load('invoice')

    const html =
      `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title></head>` +
      `<body><h1>Payment Receipt</h1><p>Patient: ${patient.fullName}</p>` +
      `<pre>${JSON.stringify(scoped.serialize(), null, 2)}</pre></body></html>`

    ctx.response.header('Content-Type', 'text/html')
    ctx.response.header('Content-Disposition', `attachment; filename="receipt-${scoped.id}.html"`)
    return ctx.response.send(html)
  }
}
