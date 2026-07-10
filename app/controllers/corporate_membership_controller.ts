import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import CorporateMembershipLead from '#models/corporate_membership_lead'
import WellnessFundSettings from '#support/wellness_fund_settings'

/**
 * Public corporate wellness-fund marketing + lead-capture flow.
 *
 * Ported from App\Http\Controllers\CorporateMembershipController. These routes
 * are unauthenticated (registered in start/routes/public.ts). The marketing
 * copy / partnership tiers come from the shared WellnessFundSettings support
 * (Settings → Wellness Fund); leads are persisted via the CorporateMembershipLead
 * model. Neither is modified here.
 */

const storeLeadValidator = vine.compile(
  vine.object({
    company_name: vine.string().trim().maxLength(200),
    contact_name: vine.string().trim().maxLength(120),
    job_title: vine.string().trim().maxLength(120).optional(),
    email: vine.string().trim().email().maxLength(200),
    phone: vine.string().trim().maxLength(40).optional(),
    registration_number: vine.string().trim().maxLength(80).optional(),
    employees_count: vine.number().min(1).optional(),
    partnership_option: vine.enum(['advance_deposit', 'hybrid']),
    estimated_deposit_or_volume: vine.number().min(0).optional(),
    message: vine.string().trim().maxLength(5000).optional(),
  })
)

export default class CorporateMembershipController {
  async show({ inertia }: HttpContext) {
    return inertia.render('wellness-fund/corporate', {
      fundName: await WellnessFundSettings.fundName(),
      partnershipOptions: await WellnessFundSettings.corporatePartnershipOptions(),
      benefits: WellnessFundSettings.corporateBenefits(),
      terms: await WellnessFundSettings.corporateTerms(),
    })
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(storeLeadValidator)

    await CorporateMembershipLead.create({
      companyName: payload.company_name,
      contactName: payload.contact_name,
      jobTitle: payload.job_title ?? null,
      email: payload.email,
      phone: payload.phone ?? null,
      registrationNumber: payload.registration_number ?? null,
      employeesCount: payload.employees_count ?? null,
      partnershipOption: payload.partnership_option,
      estimatedDepositOrVolume: payload.estimated_deposit_or_volume ?? null,
      message: payload.message ?? null,
    })

    return response.redirect('/wellness-fund/corporate/thank-you')
  }

  async thankYou({ inertia }: HttpContext) {
    return inertia.render('wellness-fund/corporate_thank_you', {
      fundName: await WellnessFundSettings.fundName(),
    })
  }
}
