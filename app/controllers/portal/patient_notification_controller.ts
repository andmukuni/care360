import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import PortalController from '#controllers/portal/portal_controller'

const PATIENT_MORPH = 'App\\Models\\Patient'

/**
 * Patient notifications. Ported from Portal\PatientNotificationController.
 *
 * Uses the polymorphic Laravel `notifications` table directly (there is no
 * dedicated Lucid model for it).
 */
export default class PatientNotificationController extends PortalController {
  async index(ctx: HttpContext) {
    const patient = this.guardian(ctx)
    const page = Number(ctx.request.input('page', 1))
    const perPage = 20

    const notifications = await db
      .from('notifications')
      .where('notifiable_type', PATIENT_MORPH)
      .where('notifiable_id', patient.id)
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)

    return ctx.inertia.render('portal/notifications/index', {
      patient,
      notifications: notifications.toJSON(),
    })
  }

  async markRead(ctx: HttpContext) {
    const patient = this.guardian(ctx)
    const notification = await db
      .from('notifications')
      .where('id', ctx.params.notification)
      .where('notifiable_type', PATIENT_MORPH)
      .where('notifiable_id', patient.id)
      .first()

    if (!notification) {
      return ctx.response.notFound({ message: 'Not found.' })
    }

    if (notification.read_at === null) {
      await db
        .from('notifications')
        .where('id', notification.id)
        .update({ read_at: DateTime.now().toSQL({ includeOffset: false }) })
    }

    return ctx.response.json({ read: true })
  }

  async markAllRead(ctx: HttpContext) {
    const patient = this.guardian(ctx)
    await db
      .from('notifications')
      .where('notifiable_type', PATIENT_MORPH)
      .where('notifiable_id', patient.id)
      .whereNull('read_at')
      .update({ read_at: DateTime.now().toSQL({ includeOffset: false }) })

    ctx.session.flash('success', 'All notifications marked as read.')
    return ctx.response.redirect('/portal/notifications')
  }
}
