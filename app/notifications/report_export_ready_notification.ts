import type ReportExport from '#models/report_export'
import type {
  AppNotification,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Report export ready (database channel).
 * Ported from App\Notifications\ReportExportReadyNotification.
 */
export class ReportExportReadyNotification implements AppNotification {
  readonly type = 'App\\Notifications\\ReportExportReadyNotification'

  constructor(private readonly reportExport: ReportExport) {}

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['database']
  }

  toDatabase(_notifiable: Notifiable): Record<string, unknown> {
    const rows = (this.reportExport.totalRows ?? 0).toLocaleString('en-US')

    return {
      title: 'Report ready',
      message: `Your "${this.reportExport.reportName}" export is ready (${rows} rows).`,
      type: 'success',
      link: `/reports/exports/${this.reportExport.id}/download`,
      export: {
        id: this.reportExport.id,
        report_type: this.reportExport.reportType,
      },
    }
  }
}
