import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import HealthTip from '#models/health_tip'

/**
 * Health tip management (daily rotating portal tips).
 * Ported from App\Http\Controllers\HealthTipController.
 *
 * The Laravel controller resolved "today's tip" through the App\Support\Portal\
 * HealthTipOfTheDay helper (which also localises copy). That helper has no Adonis
 * port yet, so the rotation is reproduced inline here — active tips ordered, index
 * chosen by (unix_ts / 10) % count — and localisation is skipped (raw copy shown).
 */
const ROTATION_SECONDS = 10

const FALLBACK_TIP = {
  category: 'Wellness',
  title: 'Take care of your health',
  message:
    'Small daily habits — water, movement, rest and regular check-ups — make a lasting difference.',
}

const tipValidator = vine.compile(
  vine.object({
    category: vine.string().trim().maxLength(80),
    title: vine.string().trim().maxLength(120),
    message: vine.string().trim().maxLength(2000),
    sort_order: vine.number().min(0).nullable().optional(),
    is_active: vine.boolean().optional(),
  })
)

export default class HealthTipsController {
  async index({ inertia }: HttpContext) {
    const tips = await HealthTip.query().orderBy('sortOrder').orderBy('id')

    const active = tips.filter((t) => t.isActive)
    const rotation = active.length
      ? active.map((t) => ({ category: t.category, title: t.title, message: t.message }))
      : [FALLBACK_TIP]
    const index = Math.floor(DateTime.now().toSeconds() / ROTATION_SECONDS) % rotation.length
    const todaysTip = rotation[index]

    return inertia.render('health-tips/index', {
      tips: tips.map((t) => ({
        id: t.id,
        category: t.category,
        title: t.title,
        message: t.message,
        sortOrder: t.sortOrder,
        isActive: t.isActive,
      })),
      todaysTip,
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(tipValidator)
    await HealthTip.create({
      category: data.category,
      title: data.title,
      message: data.message,
      sortOrder: Math.trunc(data.sort_order ?? 0),
      isActive: data.is_active ?? false,
    })

    session.flash('success', 'Health tip created.')
    return response.redirect().toPath('/health-tips')
  }

  async update({ params, request, response, session }: HttpContext) {
    const tip = await HealthTip.findOrFail(params.health_tip)
    const data = await request.validateUsing(tipValidator)

    tip.merge({
      category: data.category,
      title: data.title,
      message: data.message,
      sortOrder: Math.trunc(data.sort_order ?? 0),
      isActive: data.is_active ?? false,
    })
    await tip.save()

    session.flash('success', 'Health tip updated.')
    return response.redirect().toPath('/health-tips')
  }

  async destroy({ params, response, session }: HttpContext) {
    const tip = await HealthTip.findOrFail(params.health_tip)
    await tip.delete()

    session.flash('success', 'Health tip deleted.')
    return response.redirect().toPath('/health-tips')
  }
}
