import type Appointment from '#models/appointment'
import type {
  AppNotification,
  MailPayload,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Awaiting confirmation'
    case 'confirmed':
      return 'Confirmed'
    case 'completed':
      return 'Completed'
    case 'declined':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

/**
 * Appointment status change (mail + database).
 * Ported from App\Notifications\AppointmentStatusNotification.
 *
 * Note: the original used the named route `portal.appointments.show`; here the
 * link is emitted as a plain path (routes are owned by another phase).
 */
export class AppointmentStatusNotification implements AppNotification {
  readonly type = 'App\\Notifications\\AppointmentStatusNotification'

  constructor(
    public readonly appointment: Appointment,
    public readonly event: string
  ) {}

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['mail', 'database']
  }

  toMail(_notifiable: Notifiable): MailPayload {
    const subject = this.subject()
    return {
      subject,
      lines: [subject],
      actionText: 'View appointment',
      actionUrl: `/portal/appointments/${this.appointment.id}`,
    }
  }

  toDatabase(_notifiable: Notifiable): Record<string, unknown> {
    return {
      title: 'Appointment ' + this.event,
      message: 'Your appointment status is now: ' + statusLabel(this.appointment.status),
      link: `/portal/appointments/${this.appointment.id}`,
    }
  }

  private subject(): string {
    switch (this.event) {
      case 'confirmed':
        return 'Your appointment has been confirmed'
      case 'declined':
        return 'Your appointment request was declined'
      case 'reminder':
        return 'Appointment reminder'
      default:
        return 'Appointment update'
    }
  }
}
