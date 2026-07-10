import type {
  AppNotification,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Generic system notification (database channel).
 * Ported from App\Notifications\SystemNotification.
 */
export class SystemNotification implements AppNotification {
  readonly type = 'App\\Notifications\\SystemNotification'

  constructor(
    private readonly title: string,
    private readonly message: string,
    private readonly kind: string = 'info', // info|success|warning|error
    private readonly link: string | null = null
  ) {}

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['database']
  }

  toDatabase(_notifiable: Notifiable): Record<string, unknown> {
    return {
      title: this.title,
      message: this.message,
      type: this.kind,
      link: this.link,
    }
  }
}
