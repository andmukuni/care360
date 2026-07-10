import type ReportExport from '#models/report_export'
import type {
  AppNotification,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Report export failed (database channel).
 * Ported from App\Notifications\ReportExportFailedNotification.
 */
export class ReportExportFailedNotification implements AppNotification {
  readonly type = 'App\\Notifications\\ReportExportFailedNotification'

  constructor(private readonly reportExport: ReportExport) {}

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['database']
  }

  toDatabase(_notifiable: Notifiable): Record<string, unknown> {
    return {
      title: 'Report generation failed',
      message: `Your "${this.reportExport.reportName}" export could not be generated. Try again from Reports.`,
      type: 'error',
      link: `/reports?report_key=${this.reportExport.reportType}`,
      export: {
        id: this.reportExport.id,
        report_type: this.reportExport.reportType,
      },
    }
  }
}
