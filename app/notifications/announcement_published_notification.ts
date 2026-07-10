import type Announcement from '#models/announcement'
import type {
  AppNotification,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Announcement published (database channel).
 * Ported from App\Notifications\AnnouncementPublishedNotification.
 */
export class AnnouncementPublishedNotification implements AppNotification {
  readonly type = 'App\\Notifications\\AnnouncementPublishedNotification'

  constructor(private readonly announcement: Announcement) {}

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['database']
  }

  toDatabase(_notifiable: Notifiable): Record<string, unknown> {
    const severityType =
      this.announcement.status === 'urgent'
        ? 'warning'
        : this.announcement.status === 'follow_up'
          ? 'success'
          : 'info'

    return {
      title: this.announcement.title,
      message: this.announcement.message,
      type: severityType,
      category: 'announcement',
      announcement_status: this.announcement.status,
      announcement_id: this.announcement.id,
      link: `/announcements/${this.announcement.id}`,
      published_at: this.announcement.publishedAt ? this.announcement.publishedAt.toISO() : null,
    }
  }
}
