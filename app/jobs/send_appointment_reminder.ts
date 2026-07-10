import { DateTime } from 'luxon'
import Appointment from '#models/appointment'
import {
  NOTIFIABLE_PATIENT,
  NotificationService,
} from '#services/notifications/notification_service'
import type { Job } from '#services/queue/queue_service'
import { AppointmentStatusNotification } from '../notifications/appointment_status_notification.js'

/**
 * Daily job: remind patients of confirmed appointments happening tomorrow.
 * Ported from App\Jobs\SendAppointmentReminder (scheduled daily at 08:00).
 */
export class SendAppointmentReminder implements Job {
  constructor(private readonly notifications: NotificationService = new NotificationService()) {}

  async handle(): Promise<void> {
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd')

    const appointments = await Appointment.query()
      .where('status', 'confirmed')
      .whereNull('reminder_sent_at')
      .where((q) => {
        q.whereRaw('confirmed_date::date = ?', [tomorrow]).orWhere((q2) => {
          q2.whereNull('confirmed_date').whereRaw('preferred_date::date = ?', [tomorrow])
        })
      })
      .preload('patient')

    for (const appointment of appointments) {
      const patient = appointment.patient
      if (!patient) {
        continue
      }

      await this.notifications.send(
        patient,
        new AppointmentStatusNotification(appointment, 'reminder'),
        NOTIFIABLE_PATIENT
      )

      appointment.reminderSentAt = DateTime.now()
      await appointment.save()
    }
  }
}
