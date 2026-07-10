import type {
  AppNotification,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Clinical recommendation (database channel).
 * Ported from App\Notifications\RecommendationNotification.
 */
export class RecommendationNotification implements AppNotification {
  readonly type = 'App\\Notifications\\RecommendationNotification'

  constructor(
    private readonly title: string,
    private readonly message: string,
    private readonly kind: string = 'info',
    private readonly link: string | null = null,
    private readonly audience: string = 'user',
    private readonly fingerprint: string | null = null,
    private readonly context: Record<string, unknown> = {}
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
      category: 'recommendation',
      audience: this.audience,
      fingerprint: this.fingerprint,
      context: this.context,
    }
  }
}
