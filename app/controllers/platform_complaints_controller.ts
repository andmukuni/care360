import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PlatformComplaint from '#models/platform_complaint'

/**
 * Platform complaint / issue reporting for staff.
 * Ported from App\Http\Controllers\PlatformComplaintController (+ StorePlatformComplaintRequest).
 *
 * The Laravel version paginated the current user's complaints server-side; here
 * `index` returns the full ordered set for a client-side DataTable.
 */
const complaintValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(160),
    description: vine.string().trim().maxLength(5000),
    page_url: vine.string().trim().url().maxLength(2048).nullable().optional(),
    severity: vine.enum(['low', 'medium', 'high']),
  })
)

export default class PlatformComplaintsController {
  async index({ inertia, auth }: HttpContext) {
    const userId = auth.user?.id ?? 0

    const complaints = await PlatformComplaint.query()
      .where('userId', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    return inertia.render('complaints/index', {
      complaints: complaints.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        pageUrl: c.pageUrl,
        severity: c.severity,
        status: c.status,
        createdAt: c.createdAt ? c.createdAt.toISO() : null,
        resolvedAt: c.resolvedAt ? c.resolvedAt.toISO() : null,
      })),
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const data = await request.validateUsing(complaintValidator)

    await PlatformComplaint.create({
      userId: auth.user?.id ?? null,
      title: data.title,
      description: data.description,
      pageUrl: data.page_url ?? null,
      severity: data.severity,
      status: 'open',
    })

    session.flash('success', 'Complaint submitted successfully. Thank you for reporting the issue.')
    return response.redirect().toPath('/complaints')
  }
}
