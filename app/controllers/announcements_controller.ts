import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Announcement from '#models/announcement'
import Role from '#models/role'
import User from '#models/user'
import { USER_MORPH_TYPE } from '#services/auth/rbac_service'
import { notificationService } from '#services/notifications/notification_service'
import { AnnouncementPublishedNotification } from '../notifications/announcement_published_notification.js'

/**
 * Staff announcements. Ported from App\Http\Controllers\AnnouncementController.
 *
 * `target_roles` is persisted as a JSON string in the `target_roles` column
 * (the Adonis model exposes it as a raw string, unlike Laravel's array cast),
 * so it is parsed/serialised explicitly here. The Laravel `manage` view was a
 * paginated table; here the index returns the full ordered list for the shared
 * client-side DataTable.
 */
function parseRoles(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((r) => String(r)).filter((r) => r !== '') : []
  } catch {
    return []
  }
}

async function visibleToUser(announcement: Announcement, user: User): Promise<boolean> {
  const publishedAt = announcement.publishedAt
  if (!announcement.isActive || publishedAt === null || publishedAt > DateTime.now()) {
    return false
  }
  if (announcement.audience === 'all') {
    return true
  }
  const roles = parseRoles(announcement.targetRoles)
  if (roles.length === 0) {
    return false
  }
  return user.hasAnyRole(roles)
}

const storeValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(180),
    message: vine.string().trim().maxLength(5000),
    status: vine.enum(['general', 'urgent', 'follow_up']),
    audience: vine.enum(['all', 'roles']),
    target_roles: vine.array(vine.string()).optional(),
  })
)

export default class AnnouncementsController {
  async manage({ inertia }: HttpContext) {
    const announcements = await Announcement.query()
      .preload('createdByUser', (q) => q.select('id', 'name'))
      .orderBy('published_at', 'desc')
      .orderBy('id', 'desc')

    const roles = await Role.query().orderBy('name').select('name')

    return inertia.render('announcements/manage', {
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        status: a.status,
        audience: a.audience,
        target_roles: parseRoles(a.targetRoles),
        author: a.createdByUser?.name ?? null,
        is_active: a.isActive,
        published_at: a.publishedAt?.toISO() ?? null,
      })),
      roles: roles.map((r) => r.name),
    })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const payload = await request.validateUsing(storeValidator)

    const targetRoles =
      payload.audience === 'roles'
        ? (payload.target_roles ?? []).filter((r) => r !== '')
        : []

    if (payload.audience === 'roles' && targetRoles.length === 0) {
      session.flash('error', 'Select at least one role for role-based announcements.')
      return response.redirect().back()
    }

    const announcement = await Announcement.create({
      title: payload.title.trim(),
      message: payload.message.trim(),
      status: payload.status,
      audience: payload.audience,
      targetRoles: targetRoles.length ? JSON.stringify(targetRoles) : JSON.stringify([]),
      createdBy: auth.user?.id ?? null,
      publishedAt: DateTime.now(),
      isActive: true,
    })

    const recipients = await this.recipientsFor(announcement.audience, targetRoles)
    for (const recipient of recipients) {
      await notificationService.send(
        { id: recipient.id, email: recipient.email, name: recipient.name },
        new AnnouncementPublishedNotification(announcement)
      )
    }

    session.flash('success', 'Announcement published successfully.')
    return response.redirect().toPath('/announcements/manage')
  }

  async show({ auth, params, inertia, response }: HttpContext) {
    const announcement = await Announcement.query()
      .where('id', params.announcement)
      .preload('createdByUser', (q) => q.select('id', 'name'))
      .firstOrFail()

    const user = auth.use('web').user!
    if (!(await visibleToUser(announcement, user))) {
      return response.forbidden('Forbidden')
    }

    return inertia.render('announcements/show', {
      announcement: {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        status: announcement.status,
        audience: announcement.audience,
        target_roles: parseRoles(announcement.targetRoles),
        author: announcement.createdByUser?.name ?? null,
        published_at: announcement.publishedAt?.toISO() ?? null,
        published_at_human: announcement.publishedAt?.toRelative() ?? null,
      },
    })
  }

  async widget({ auth, response }: HttpContext) {
    const user = auth.use('web').user!

    const candidates = await Announcement.query()
      .preload('createdByUser', (q) => q.select('id', 'name'))
      .where('is_active', true)
      .whereNotNull('published_at')
      .where('published_at', '<=', DateTime.now().toSQL())
      .orderBy('published_at', 'desc')
      .orderBy('id', 'desc')
      .limit(30)

    const visible: Announcement[] = []
    for (const announcement of candidates) {
      if (await visibleToUser(announcement, user)) {
        visible.push(announcement)
      }
      if (visible.length >= 8) break
    }

    return response.json({
      items: visible.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message.length > 180 ? `${a.message.slice(0, 179)}…` : a.message,
        status: a.status,
        published_at_human: a.publishedAt?.toRelative() ?? null,
        published_at_iso: a.publishedAt?.toISO() ?? null,
        author: a.createdByUser?.name ?? null,
        link: `/announcements/${a.id}`,
      })),
    })
  }

  private async recipientsFor(audience: string, targetRoles: string[]): Promise<User[]> {
    if (audience !== 'roles') {
      return User.all()
    }
    if (targetRoles.length === 0) {
      return []
    }
    const rows = await db
      .from('model_has_roles')
      .join('roles', 'roles.id', 'model_has_roles.role_id')
      .where('model_has_roles.model_type', USER_MORPH_TYPE)
      .whereIn('roles.name', targetRoles)
      .distinct('model_has_roles.model_id as id')
    const ids = rows.map((r) => Number(r.id))
    if (ids.length === 0) {
      return []
    }
    return User.query().whereIn('id', ids)
  }
}
