import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Patient from '#models/patient'
import Notification from '#models/notification'
import { abort } from '#services/portal/portal_errors'
import { pageParam } from './lab_controller.js'

const PATIENT_MORPH = 'App\\Models\\Patient'

/**
 * Portal notifications. Ported from
 * App\Http\Controllers\Api\Portal\NotificationController.
 *
 * Notifications are account-scoped to the guardian (Laravel Notifiable trait,
 * polymorphic on notifiable_type / notifiable_id).
 */
export default class NotificationController {
  async index(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const page = pageParam(ctx)

    const notifications = await Notification.query()
      .where('notifiableType', PATIENT_MORPH)
      .where('notifiableId', patient.id)
      .orderBy('createdAt', 'desc')
      .paginate(page, 20)

    return ctx.response.ok({
      data: notifications.all().map((notification) => portalNotificationResource(notification)),
      meta: {
        current_page: notifications.currentPage,
        last_page: notifications.lastPage,
        per_page: notifications.perPage,
        total: notifications.total,
      },
    })
  }

  async markRead(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const notification = await Notification.find(ctx.params.notification)

    if (
      !notification ||
      notification.notifiableType !== PATIENT_MORPH ||
      Number(notification.notifiableId) !== Number(patient.id)
    ) {
      abort(404)
    }

    if (notification!.readAt === null) {
      notification!.readAt = DateTime.now()
      await notification!.save()
    }

    return ctx.response.ok({ read: true })
  }

  async markAllRead(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient

    await Notification.query()
      .where('notifiableType', PATIENT_MORPH)
      .where('notifiableId', patient.id)
      .whereNull('readAt')
      .update({ readAt: DateTime.now().toSQL({ includeOffset: false }) })

    return ctx.response.ok({ message: 'All notifications marked as read.' })
  }
}

/** Reproduces App\Http\Resources\Portal\PortalNotificationResource. */
export function portalNotificationResource(notification: Notification): Record<string, unknown> {
  let data: Record<string, unknown> = {}
  try {
    const parsed = typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  } catch {
    data = {}
  }

  return {
    id: notification.id,
    title: data.title ?? 'Notification',
    message: data.message ?? '',
    link: data.link ?? null,
    read_at: notification.readAt ? notification.readAt.toISO() : null,
    created_at: notification.createdAt ? notification.createdAt.toISO() : null,
  }
}
