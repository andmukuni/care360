import { createWriteStream, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import ReportExport from '#models/report_export'
import User from '#models/user'
import type ScreeningRecord from '#models/screening_record'
import { AncRegisterCsvWriter } from '#support/reports/exports/anc_register_csv_writer'
import { ArtRegisterCsvWriter } from '#support/reports/exports/art_register_csv_writer'
import { GynObsCsvWriter } from '#support/reports/exports/gyn_obs_csv_writer'
import { HiaRegisterCsvWriter } from '#support/reports/exports/hia_register_csv_writer'
import { OpdRegisterCsvWriter } from '#support/reports/exports/opd_register_csv_writer'
import { PncRegisterCsvWriter } from '#support/reports/exports/pnc_register_csv_writer'
import { HiaReportAggregator } from '#support/reports/hia/hia_report_aggregator'
import { PresumptiveTbQuery } from '#support/reports/presumptive_tb_query'
import {
  StreamCsvSink,
  UTF8_BOM,
  chunkQuery,
  clinicianNameMap,
  fmtDMYHi,
  fmtYmdHi,
  type CsvSink,
  type ReportFilters,
} from '#support/reports/support'
import { NotificationService } from '#services/notifications/notification_service'
import type { Job } from '#services/queue/queue_service'
import { ReportExportReadyNotification } from '../notifications/report_export_ready_notification.js'
import { ReportExportFailedNotification } from '../notifications/report_export_failed_notification.js'

const CHUNK_SIZE = 500

const STATUS_PENDING = 'pending'
const STATUS_PROCESSING = 'processing'
const STATUS_COMPLETED = 'completed'
const STATUS_FAILED = 'failed'

/**
 * Background CSV export of the 8 report types (+ notify).
 * Ported from App\Jobs\GenerateReportExport (queue: 'reports').
 *
 * Files are written under `storage/app/report-exports/...` to mirror Laravel's
 * local disk. (No @adonisjs/drive is installed — a follow-up could swap the raw
 * fs writes for Drive once configured.)
 */
export class GenerateReportExport implements Job {
  readonly queue = 'reports'

  constructor(
    private readonly exportId: number,
    private readonly notifications: NotificationService = new NotificationService()
  ) {}

  async handle(): Promise<void> {
    const reportExport = await ReportExport.find(this.exportId)

    if (!reportExport || reportExport.status === STATUS_COMPLETED) {
      return
    }

    try {
      reportExport.status = STATUS_PROCESSING
      reportExport.startedAt = reportExport.startedAt ?? DateTime.now()
      await reportExport.save()

      const filters = this.parseFilters(reportExport.filters)
      const relative = `report-exports/${reportExport.userId}/${reportExport.id}_${reportExport.reportType}_${DateTime.now().toFormat('yyyyMMdd_HHmmss')}.csv`
      const fullPath = join(process.cwd(), 'storage', 'app', relative)
      mkdirSync(dirname(fullPath), { recursive: true })

      const stream = createWriteStream(fullPath, { encoding: 'utf8' })
      const sink = new StreamCsvSink(stream)

      stream.write(UTF8_BOM)
      sink.write(['BARCODES'])
      sink.write([reportExport.reportName])
      sink.write(['Generated: ' + fmtDMYHi(DateTime.now())])
      sink.write([])

      const totalRows = await this.writeReport(reportExport, filters, sink)

      await new Promise<void>((resolve, reject) => {
        stream.on('error', reject)
        stream.end(() => resolve())
      })

      const size = statSync(fullPath).size

      reportExport.status = STATUS_COMPLETED
      reportExport.filePath = relative
      reportExport.fileSize = size
      reportExport.totalRows = totalRows
      reportExport.processedRows = totalRows
      reportExport.completedAt = DateTime.now()
      reportExport.expiresAt = DateTime.now().plus({ hours: 5 })
      await reportExport.save()

      await this.notifyUserReady(reportExport)
    } catch (error) {
      logger.error(
        { exportId: this.exportId, err: error },
        'ReportExport failed'
      )

      reportExport.status = STATUS_FAILED
      reportExport.errorMessage = String((error as Error)?.message ?? error).substring(0, 1000)
      reportExport.completedAt = DateTime.now()
      await reportExport.save()

      await this.notifyUserFailed(reportExport)

      throw error
    }
  }

  private async writeReport(
    reportExport: ReportExport,
    filters: ReportFilters,
    sink: CsvSink
  ): Promise<number> {
    const onProgress = async (count: number) => {
      reportExport.processedRows = count
      await reportExport.save()
    }

    switch (reportExport.reportType) {
      case 'opd_register':
        return new OpdRegisterCsvWriter().write(sink, filters, onProgress)
      case 'presumptive_tb':
        return this.writePresumptiveTb(sink, filters, reportExport)
      case 'gyn_obs':
        return this.writeGynObs(sink, filters, reportExport)
      case 'pnc_register':
        return new PncRegisterCsvWriter().write(sink, filters, onProgress)
      case 'anc_register':
        return new AncRegisterCsvWriter().write(sink, filters, onProgress)
      case 'art_register':
        return new ArtRegisterCsvWriter().write(sink, filters, onProgress)
      case 'hia_one_a':
        return this.writeHiaRegister(sink, 'a', filters)
      case 'hia_one_b':
        return this.writeHiaRegister(sink, 'b', filters)
      default:
        throw new Error('Unsupported report type: ' + reportExport.reportType)
    }
  }

  private async writeGynObs(
    sink: CsvSink,
    filters: ReportFilters,
    reportExport: ReportExport
  ): Promise<number> {
    const start = (filters.start_date ? DateTime.fromISO(filters.start_date) : DateTime.now().startOf('month')).startOf(
      'day'
    )
    const end = (filters.end_date ? DateTime.fromISO(filters.end_date) : DateTime.now()).endOf('day')

    const processed = await new GynObsCsvWriter().write(sink, start, end)
    reportExport.processedRows = processed
    await reportExport.save()

    return processed
  }

  private async writePresumptiveTb(
    sink: CsvSink,
    filters: ReportFilters,
    reportExport: ReportExport
  ): Promise<number> {
    sink.write(['Period: ' + PresumptiveTbQuery.periodLabel(filters)])
    sink.write([])
    sink.write([
      'Case No',
      'Screened At',
      'Patient',
      'Encounter',
      'Constitutional Symptoms',
      'Clinician',
    ])

    let processed = 0

    const query = PresumptiveTbQuery.build(filters).preload('patient').preload('encounter')

    await chunkQuery<ScreeningRecord>(query, CHUNK_SIZE, async (records) => {
      const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
      for (const record of records) {
        sink.write([
          record.presumptiveTbCaseNo,
          record.screeningStartedAt ? fmtYmdHi(record.screeningStartedAt) : '',
          record.patient?.fullName ?? '',
          record.encounter?.encounterNumber ?? '',
          record.constitutionalSymptoms || '',
          clinicians.get(record.clinicianId) ?? '',
        ])
        processed++
      }
      reportExport.processedRows = processed
      await reportExport.save()
    })

    return processed
  }

  private async writeHiaRegister(
    sink: CsvSink,
    variant: string,
    filters: ReportFilters
  ): Promise<number> {
    const payload = await new HiaReportAggregator().aggregate(variant, filters)
    return await new HiaRegisterCsvWriter().write(sink, variant, payload, filters)
  }

  private parseFilters(filters: string | null): ReportFilters {
    if (!filters) {
      return {}
    }
    try {
      const parsed = JSON.parse(filters)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  private async notifyUserReady(reportExport: ReportExport): Promise<void> {
    const user = await User.find(reportExport.userId)
    if (user) {
      await this.notifications.send(user, new ReportExportReadyNotification(reportExport))
    }
  }

  private async notifyUserFailed(reportExport: ReportExport): Promise<void> {
    const user = await User.find(reportExport.userId)
    if (user) {
      await this.notifications.send(user, new ReportExportFailedNotification(reportExport))
    }
  }
}

export { STATUS_PENDING, STATUS_PROCESSING, STATUS_COMPLETED, STATUS_FAILED }
