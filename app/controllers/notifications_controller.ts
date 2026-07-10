import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Notification from '#models/notification'
import { NOTIFIABLE_USER } from '#services/notifications/notification_service'

/**
 * Staff in-app notifications. Ported from App\Http\Controllers\NotificationController.
 *
 * Notifications live in the Laravel-compatible `notifications` table (uuid id,
 * JSON `data`, polymorphic notifiable). The Laravel controller mixed JSON and
 * redirect responses; here everything routes through Inertia (index renders a
 * page, the mutations redirect back with a flash message).
 */
function parseData(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export default class NotificationsController {
  async index({ auth, inertia }: HttpContext) {
    const user = auth.user!

    const notifications = await Notification.query()
      .where('notifiable_type', NOTIFIABLE_USER)
      .where('notifiable_id', user.id)
      .orderBy('created_at', 'desc')

    return inertia.render('notifications/index', {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        data: parseData(n.data),
        read: n.readAt !== null,
        read_at: n.readAt?.toISO() ?? null,
        created_at: n.createdAt?.toISO() ?? null,
        created_at_human: n.createdAt?.toRelative() ?? null,
      })),
      unreadCount: notifications.filter((n) => n.readAt === null).length,
    })
  }

  async markRead({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const notification = await Notification.findOrFail(params.notification)

    if (notification.notifiableId !== user.id || notification.notifiableType !== NOTIFIABLE_USER) {
      return response.forbidden('Forbidden')
    }

    if (notification.readAt === null) {
      notification.readAt = DateTime.now()
      await notification.save()
    }

    return response.redirect().back()
  }

  async markAllRead({ auth, response, session }: HttpContext) {
    const user = auth.user!

    await Notification.query()
      .where('notifiable_type', NOTIFIABLE_USER)
      .where('notifiable_id', user.id)
      .whereNull('read_at')
      .update({ read_at: DateTime.now().toSQL() })

    session.flash('success', 'All notifications marked as read.')
    return response.redirect().back()
  }

  async destroy({ auth, params, response, session }: HttpContext) {
    const user = auth.user!
    const notification = await Notification.findOrFail(params.notification)

    if (notification.notifiableId !== user.id || notification.notifiableType !== NOTIFIABLE_USER) {
      return response.forbidden('Forbidden')
    }

    await notification.delete()

    session.flash('success', 'Notification dismissed.')
    return response.redirect().back()
  }
}
