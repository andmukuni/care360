import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import CorporateMembershipLead from '#models/corporate_membership_lead'
import { num } from '#support/money_helpers'

/**
 * Corporate membership lead pipeline (inbound partnership enquiries).
 * Ported from App\Http\Controllers\CorporateMembershipLeadController.
 *
 * The Laravel version paginated leads server-side; here `index` returns the full
 * ordered set for a client-side DataTable.
 */
const statusValidator = vine.compile(
  vine.object({
    status: vine.enum(['new', 'reviewed', 'contacted']),
  })
)

export default class CorporateMembershipLeadsController {
  async index({ inertia }: HttpContext) {
    const leads = await CorporateMembershipLead.query()
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    return inertia.render('corporate-leads/index', {
      leads: leads.map((l) => ({
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        jobTitle: l.jobTitle,
        email: l.email,
        phone: l.phone,
        registrationNumber: l.registrationNumber,
        employeesCount: l.employeesCount,
        partnershipOption: l.partnershipOption,
        estimatedDepositOrVolume:
          l.estimatedDepositOrVolume !== null ? num(l.estimatedDepositOrVolume) : null,
        message: l.message,
        status: l.status,
        createdAt: l.createdAt ? l.createdAt.toISO() : null,
      })),
    })
  }

  async updateStatus({ params, request, response, session }: HttpContext) {
    const lead = await CorporateMembershipLead.findOrFail(params.lead)
    const { status } = await request.validateUsing(statusValidator)

    lead.status = status
    await lead.save()

    session.flash('success', 'Lead status updated.')
    return response.redirect().back()
  }
}
