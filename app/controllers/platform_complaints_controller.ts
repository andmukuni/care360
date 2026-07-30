import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import PlatformComplaint from '#models/platform_complaint'
import type User from '#models/user'

/**
 * Platform complaint / issue reporting for staff.
 * Ported from App\Http\Controllers\PlatformComplaintController (+ StorePlatformComplaintRequest).
 *
 * Regular staff see only their own reports. Super-admins see every report and
 * can resolve any of them.
 */
const complaintValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(160),
    description: vine.string().trim().maxLength(5000),
    page_url: vine.string().trim().url().maxLength(2048).nullable().optional(),
    severity: vine.enum(['low', 'medium', 'high']),
  })
)

async function canManageAllComplaints(user: User | undefined): Promise<boolean> {
  if (!user) return false
  return user.hasRole('super-admin')
}

function serializeComplaint(c: PlatformComplaint, includeReporter: boolean) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    pageUrl: c.pageUrl,
    severity: c.severity,
    status: c.status,
    createdAt: c.createdAt ? c.createdAt.toISO() : null,
    createdAtFormatted: c.createdAt ? c.createdAt.toFormat('dd LLL yyyy HH:mm') : null,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISO() : null,
    resolvedAtFormatted: c.resolvedAt ? c.resolvedAt.toFormat('dd LLL yyyy HH:mm') : null,
    reporterName: includeReporter ? (c.user?.name ?? null) : null,
    reporterEmail: includeReporter ? (c.user?.email ?? null) : null,
  }
}

export default class PlatformComplaintsController {
  async index({ inertia, auth }: HttpContext) {
    const user = auth.user
    const userId = user?.id ?? 0
    const viewAll = await canManageAllComplaints(user)

    const query = PlatformComplaint.query().orderBy('createdAt', 'desc').orderBy('id', 'desc')

    if (viewAll) {
      query.preload('user', (q) => q.select('id', 'name', 'email'))
    } else {
      query.where('userId', userId)
    }

    const complaints = await query

    return inertia.render('complaints/index', {
      complaints: complaints.map((c) => serializeComplaint(c, viewAll)),
      viewAll,
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

  /**
   * Mark a complaint as resolved.
   * Owners can resolve their own; super-admins can resolve any.
   */
  async resolve({ params, response, session, auth }: HttpContext) {
    const user = auth.user
    const userId = user?.id ?? 0
    const viewAll = await canManageAllComplaints(user)

    const query = PlatformComplaint.query().where('id', params.id)
    if (!viewAll) {
      query.where('userId', userId)
    }

    const complaint = await query.firstOrFail()

    if (complaint.status !== 'resolved') {
      complaint.status = 'resolved'
      complaint.resolvedAt = DateTime.now()
      await complaint.save()
    }

    session.flash('success', 'Complaint marked as resolved.')
    return response.redirect().toPath('/complaints')
  }
}
