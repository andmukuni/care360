import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import MembershipPlan from '#models/membership_plan'
import WellnessFundAccount from '#models/wellness_fund_account'

/**
 * Individual membership tier CRUD. Ported from App\Http\Controllers\MembershipPlanController.
 *
 * The Laravel Blade page listed plans and offered inline create/edit forms; here
 * `index` returns the full ordered row set for the Inertia page which renders the
 * table plus create/edit modals.
 */
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Perks are stored as a JSON array (matching the Laravel `array` cast). */
function perksToArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter((v) => v !== '')
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const decoded = JSON.parse(raw)
      if (Array.isArray(decoded)) {
        return decoded.map((v) => String(v).trim()).filter((v) => v !== '')
      }
    } catch {
      // fall through to line-splitting
    }
    return raw
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
  }
  return []
}

function parsePerks(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === '') {
    return []
  }
  return raw
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

const planValidator = vine.compile(
  vine.object({
    name: vine.string().trim().maxLength(80),
    tier: vine.number().min(1).max(4),
    description: vine.string().trim().maxLength(1000).nullable().optional(),
    minimum_deposit: vine.number().min(0),
    min_balance: vine.number().min(0).nullable().optional(),
    discount_percent: vine.number().min(0).max(100),
    perks: vine.string().trim().maxLength(2000).nullable().optional(),
    is_active: vine.boolean().optional(),
    sort_order: vine.number().min(0).nullable().optional(),
  })
)

export default class MembershipPlansController {
  async index({ inertia }: HttpContext) {
    const plans = await MembershipPlan.query()
      .where('membershipType', 'individual')
      .withCount('wellnessFundAccounts', (q) =>
        q.where('status', 'active').as('active_subscriptions_count')
      )
      .orderBy('sortOrder')
      .orderBy('tier')

    return inertia.render('memberships/index', {
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        tier: plan.tier,
        description: plan.description,
        minimumDeposit: Number(plan.minimumDeposit),
        minBalance: plan.minBalance !== null ? Number(plan.minBalance) : null,
        discountPercent: Number(plan.discountPercent),
        perks: perksToArray(plan.perks),
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        activeSubscriptionsCount: Number(plan.$extras.active_subscriptions_count ?? 0),
      })),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(planValidator)

    const slug = slugify(data.name)
    const exists = await MembershipPlan.query().where('slug', slug).first()
    if (exists) {
      session.flashErrors({ name: 'A plan with a similar name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    await MembershipPlan.create(this.attributes(data, slug))

    session.flash('success', `Plan “${data.name}” created.`)
    return response.redirect().toPath('/memberships')
  }

  async update({ params, request, response, session }: HttpContext) {
    const plan = await MembershipPlan.findOrFail(params.membership)
    const data = await request.validateUsing(planValidator)

    const slug = slugify(data.name)
    const exists = await MembershipPlan.query().where('slug', slug).whereNot('id', plan.id).first()
    if (exists) {
      session.flashErrors({ name: 'A plan with a similar name already exists.' })
      session.flashAll()
      return response.redirect().back()
    }

    plan.merge(this.attributes(data, slug))
    await plan.save()

    session.flash('success', `Plan “${plan.name}” updated.`)
    return response.redirect().toPath('/memberships')
  }

  async destroy({ params, response, session }: HttpContext) {
    const plan = await MembershipPlan.findOrFail(params.membership)

    const hasActive = await WellnessFundAccount.query()
      .where('membershipPlanId', plan.id)
      .where('status', 'active')
      .first()

    if (hasActive) {
      session.flash('error', 'Cannot delete a plan with active fund accounts. Deactivate it instead.')
      return response.redirect().back()
    }

    await plan.delete()

    session.flash('success', 'Plan deleted.')
    return response.redirect().toPath('/memberships')
  }

  private attributes(
    data: {
      name: string
      tier: number
      description?: string | null
      minimum_deposit: number
      min_balance?: number | null
      discount_percent: number
      perks?: string | null
      is_active?: boolean
      sort_order?: number | null
    },
    slug: string
  ): Record<string, any> {
    const tier = Math.trunc(data.tier)

    return {
      name: data.name,
      slug,
      membershipType: 'individual',
      tier,
      description: data.description ?? null,
      minimumDeposit: data.minimum_deposit,
      minBalance: tier === 1 ? (data.min_balance ?? 0) : null,
      discountPercent: data.discount_percent,
      perks: JSON.stringify(parsePerks(data.perks)),
      isActive: data.is_active ?? false,
      sortOrder: Math.trunc(data.sort_order ?? 0),
    }
  }
}
