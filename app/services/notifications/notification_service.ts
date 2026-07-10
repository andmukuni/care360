import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

export type NotificationChannel = 'database' | 'mail'

/**
 * Anything that can receive a notification. Backed by a `users` or `patients`
 * row. `email` / `fullName` / `name` are only needed for the mail channel.
 */
export interface Notifiable {
  id: number
  email?: string | null
  fullName?: string
  name?: string
}

/** Structured mail content (mirrors Laravel's MailMessage builder). */
export interface MailPayload {
  subject: string
  greeting?: string
  lines: string[]
  actionText?: string
  actionUrl?: string
}

/**
 * Notification contract. `type` is stored verbatim in `notifications.type`
 * (kept as the Laravel FQN, e.g. `App\\Notifications\\SystemNotification`, so
 * data written by either app is interchangeable).
 */
export interface AppNotification {
  readonly type: string
  via(notifiable: Notifiable): NotificationChannel[]
  toDatabase?(notifiable: Notifiable): Record<string, unknown>
  toMail?(notifiable: Notifiable): MailPayload
}

export const NOTIFIABLE_USER = 'App\\Models\\User'
export const NOTIFIABLE_PATIENT = 'App\\Models\\Patient'

/**
 * NotificationService
 * ───────────────────────────────────────────────────────────────────────────
 * Canonical entry point for delivering notifications. `notifyDatabase()` is the
 * low-level primitive (inserts a Laravel-compatible row into `notifications`);
 * `send()` routes a notification object across its `via()` channels.
 *
 * Mail channel: `@adonisjs/mail` is installed but NOT configured (there is no
 * `config/mail.ts`). Mail sending is therefore guarded behind a config check —
 * see coordinator notes. Database notifications work unconditionally.
 */
export class NotificationService {
  /**
   * Insert a database notification row (uuid id, JSON data). Mirrors Laravel's
   * `notifications` table shape exactly.
   */
  async notifyDatabase(
    notifiable: Notifiable,
    type: string,
    data: Record<string, unknown>,
    notifiableType: string = NOTIFIABLE_USER
  ): Promise<string> {
    const id = randomUUID()
    const now = DateTime.now().toSQL()

    await db.table('notifications').insert({
      id,
      type,
      notifiable_type: notifiableType,
      notifiable_id: notifiable.id,
      data: JSON.stringify(data),
      read_at: null,
      created_at: now,
      updated_at: now,
    })

    return id
  }

  /**
   * Deliver a notification across every channel returned by its `via()`.
   */
  async send(
    notifiable: Notifiable,
    notification: AppNotification,
    notifiableType: string = NOTIFIABLE_USER
  ): Promise<void> {
    const channels = notification.via(notifiable)

    for (const channel of channels) {
      if (channel === 'database' && notification.toDatabase) {
        await this.notifyDatabase(
          notifiable,
          notification.type,
          notification.toDatabase(notifiable),
          notifiableType
        )
      } else if (channel === 'mail' && notification.toMail) {
        await this.sendMail(notifiable, notification.toMail(notifiable))
      }
    }
  }

  /**
   * Send a mail notification IF mail is configured. When it is not, the mail is
   * skipped with a warning so database delivery still succeeds.
   */
  private async sendMail(notifiable: Notifiable, payload: MailPayload): Promise<void> {
    const to = notifiable.email
    if (!to) {
      return
    }

    if (!this.isMailConfigured()) {
      logger.warn(
        { subject: payload.subject, to },
        'Mail channel skipped: @adonisjs/mail is not configured (no config/mail.ts). See Phase 7 coordinator notes.'
      )
      return
    }

    try {
      // Imported lazily so the app boots even when mail is not wired up.
      const { default: mail } = await import('@adonisjs/mail/services/main')
      const bodyText = [payload.greeting, ...payload.lines, payload.actionUrl ? `${payload.actionText ?? 'Open'}: ${payload.actionUrl}` : undefined]
        .filter((line): line is string => typeof line === 'string' && line.length > 0)
        .join('\n\n')

      await mail.send((message) => {
        message.to(to).subject(payload.subject).text(bodyText)
      })
    } catch (error) {
      logger.error({ err: error, subject: payload.subject }, 'Failed to send mail notification')
    }
  }

  private isMailConfigured(): boolean {
    // config/mail.ts is absent; only attempt delivery when an operator has
    // explicitly provided a mailer via env.
    return Boolean(process.env.MAIL_MAILER)
  }
}

/** Shared singleton for convenience. */
export const notificationService = new NotificationService()
