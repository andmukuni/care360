import type {
  AppNotification,
  MailPayload,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Portal invitation email (mail channel only).
 * Ported from App\Notifications\PortalInvitationNotification.
 */
export class PortalInvitationNotification implements AppNotification {
  readonly type = 'App\\Notifications\\PortalInvitationNotification'

  constructor(private readonly resetUrl: string) {}

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['mail']
  }

  toMail(notifiable: Notifiable): MailPayload {
    const name = notifiable.fullName ?? notifiable.name ?? ''
    return {
      subject: 'Your patient portal account',
      greeting: `Hello ${name},`,
      lines: [
        'Your health centre has enabled access to the patient portal where you can view your profile, visit history, lab results, and prescriptions.',
        'This link expires in 60 minutes. If you did not expect this email, you can ignore it.',
      ],
      actionText: 'Set your password',
      actionUrl: this.resetUrl,
    }
  }
}
