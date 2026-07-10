import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ReportExport from '#models/report_export'
import Patient from '#models/patient'
import { GenerateReportExport } from '../jobs/generate_report_export.js'
import { queue } from '#services/queue/queue_service'
import { GynObsReportService } from '#services/gyn_obs/gyn_obs_report_service'
import { ReportCatalogue } from '#support/reports/report_catalogue'
import { reportConfig } from '#support/reports/report_config'
import { OpdRegisterQuery } from '#support/reports/opd_register_query'
import { OpdRegisterColumns } from '#support/reports/opd_register_columns'
import { OpdRegisterRowMapper } from '#support/reports/opd_register_row_mapper'
import { PresumptiveTbQuery } from '#support/reports/presumptive_tb_query'
import { PncRegisterQuery } from '#support/reports/pnc_register_query'
import { PncRegisterColumns } from '#support/reports/pnc_register_columns'
import { PncRegisterRowMapper } from '#support/reports/pnc_register_row_mapper'
import { AncRegisterQuery } from '#support/reports/anc_register_query'
import { AncRegisterColumns } from '#support/reports/anc_register_columns'
import { AncRegisterRowMapper } from '#support/reports/anc_register_row_mapper'
import { ArtRegisterQuery } from '#support/reports/art_register_query'
import { ArtRegisterColumns } from '#support/reports/art_register_columns'
import { ArtRegisterRowMapper } from '#support/reports/art_register_row_mapper'
import { HiaCatalogue } from '#support/reports/hia/hia_catalogue'
import { HiaReportAggregator } from '#support/reports/hia/hia_report_aggregator'
import { GynObsCsvWriter } from '#support/reports/exports/gyn_obs_csv_writer'
import { OpdRegisterCsvWriter } from '#support/reports/exports/opd_register_csv_writer'
import { PncRegisterCsvWriter } from '#support/reports/exports/pnc_register_csv_writer'
import { AncRegisterCsvWriter } from '#support/reports/exports/anc_register_csv_writer'
import { ArtRegisterCsvWriter } from '#support/reports/exports/art_register_csv_writer'
import { HiaRegisterCsvWriter } from '#support/reports/exports/hia_register_csv_writer'
import {
  BufferCsvSink,
  UTF8_BOM,
  clinicianNameMap,
  fmtDMYHi,
  fmtYmdHi,
  parseDate,
  type ReportFilters,
} from '#support/reports/support'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { reportExportValidator } from '#validators/staff/report_validators'

const PREVIEW_LIMIT = 200
const ATTENDANT_TYPES = ['first_attendant', 're_attendant']

/**
 * Reports hub. Ported from App\Http\Controllers\ReportController.
 *
 * Reuses the Phase 7 report machinery (report catalogue, per-report queries,
 * columns, row mappers and CSV writers, the GynObs service and HIA aggregator)
 * unchanged — this controller only orchestrates preview + CSV streaming + the
 * background-export lifecycle for the Inertia hub.
 */
export default class ReportController {
  private readonly gynObs = new GynObsReportService()

  async index(ctx: HttpContext) {
    const { request, inertia, auth, session } = ctx
    const qs = request.qs()

    const startDate = String(qs.start_date ?? DateTime.now().startOf('month').toFormat('yyyy-MM-dd'))
    const endDate = String(qs.end_date ?? DateTime.now().toFormat('yyyy-MM-dd'))
    const attendantType = String(qs.attendant_type ?? '')

    let activeReport = null
    if (qs.report_key) {
      activeReport = ReportCatalogue.findByKey(String(qs.report_key))
    }

    const userId = auth.user?.id ?? 0

    const pendingExports = await ReportExport.query()
      .where('user_id', userId)
      .whereIn('status', ['pending', 'processing'])
      .where('created_at', '>=', DateTime.now().minus({ days: 1 }).toSQL()!)
      .orderBy('created_at', 'desc')

    const readyExports = await ReportExport.query()
      .where('user_id', userId)
      .where('status', 'completed')
      .whereNotNull('file_path')
      .where('created_at', '>=', DateTime.now().minus({ days: 7 }).toSQL()!)
      .orderBy('completed_at', 'desc')

    const failedExports = await ReportExport.query()
      .where('user_id', userId)
      .where('status', 'failed')
      .where('created_at', '>=', DateTime.now().minus({ days: 7 }).toSQL()!)
      .orderBy('created_at', 'desc')

    const lastCompleted = await ReportExport.query()
      .where('user_id', userId)
      .where('status', 'completed')
      .orderBy('completed_at', 'desc')
      .first()

    const lastCompletedAt = lastCompleted?.completedAt ?? null

    return inertia.render('reports/index', {
      reportCatalogue: ReportCatalogue.all(),
      reportCategories: ReportCatalogue.categories(),
      activeReport,
      initialPendingExports: pendingExports.map((e) => this.mapExportForBanner(e)),
      initialReadyExports: readyExports.map((e) => this.mapExportForBanner(e, true)),
      initialFailedExports: failedExports.map((e) => this.mapExportForBanner(e, false, true)),
      exportDispatched: Boolean(session.flashMessages.get('exportDispatched', false)),
      startDate,
      endDate,
      attendantType,
      lastGenerated: lastCompletedAt ? lastCompletedAt.toFormat('HH:mm') : null,
      lastGeneratedLabel: lastCompletedAt ? lastCompletedAt.toFormat('dd LLL yyyy') : 'No reports generated',
    })
  }

  async preview(ctx: HttpContext) {
    const { inertia, response, session } = ctx
    const validated = await this.validateExportRequest(ctx)
    if (validated === null) {
      return response.redirect().toPath('/reports')
    }

    const reportType = validated.report_type
    const filters = this.filtersForType(reportType, validated)
    const catalogueEntry = ReportCatalogue.findByKey(reportType)

    const preview = await this.buildPreview(reportType, filters)
    if (preview === null) {
      session.flash('error', 'Unable to build preview for this report.')
      return response.redirect().toPath('/reports?' + this.hubQuery(reportType, filters))
    }

    return inertia.render('reports/preview', {
      reportType,
      catalogueEntry,
      filters,
      preview,
      hubQuery: this.hubQuery(reportType, filters),
    })
  }

  async queueExport(ctx: HttpContext) {
    const { response, session } = ctx
    const validated = await this.validateExportRequest(ctx)
    if (validated === null) {
      return response.redirect().toPath('/reports')
    }

    const reportType = validated.report_type
    const filters = this.filtersForType(reportType, validated)

    await this.dispatchCsvExport(ctx, reportType, filters)

    session.flash('exportDispatched', true)
    session.flash('success', 'Report queued for background generation.')
    return response.redirect().toPath('/reports?' + this.hubQuery(reportType, filters))
  }

  async downloadCsv(ctx: HttpContext) {
    const { response, session } = ctx
    const validated = await this.validateExportRequest(ctx)
    if (validated === null) {
      return response.redirect().toPath('/reports')
    }

    const reportType = validated.report_type
    const filters = this.filtersForType(reportType, validated)

    const built = await this.buildCsv(reportType, filters)
    if (built === null) {
      session.flash('error', 'Unknown report type.')
      return response.redirect().toPath('/reports')
    }

    return response
      .header('Content-Type', 'text/csv; charset=UTF-8')
      .header('Content-Disposition', `attachment; filename="${built.filename}"`)
      .send(built.body)
  }

  /**
   * PDF export is not available: no HTML-to-PDF engine (dompdf/puppeteer/etc.)
   * is installed in the Adonis app. Returns a clear JSON status so the hub can
   * surface the limitation. DEFERRED — see return note.
   */
  async downloadPdf(ctx: HttpContext) {
    return ctx.response.status(501).json({
      available: false,
      message:
        'PDF export is not available in this environment (no PDF rendering engine installed). Use CSV export instead.',
    })
  }

  async downloadExport(ctx: HttpContext) {
    const { params, response, auth, session } = ctx
    const exportRow = await ReportExport.find(params.export)
    if (!exportRow) {
      session.flash('error', 'Export not found.')
      return response.redirect().back()
    }

    if (exportRow.userId !== auth.user?.id) {
      return response.forbidden('Forbidden')
    }

    if (exportRow.status !== 'completed' || !exportRow.filePath) {
      session.flash('error', 'Report is not ready for download yet.')
      return response.redirect().back()
    }

    const fullPath = join(process.cwd(), 'storage', 'app', exportRow.filePath)
    if (!existsSync(fullPath)) {
      session.flash('error', 'Report file has expired or been removed.')
      return response.redirect().back()
    }

    const createdAt = exportRow.createdAt ?? DateTime.now()
    const filename =
      exportRow.reportName.replace(/\s+/g, '_').toLowerCase() + '_' + createdAt.toFormat('yyyy-MM-dd') + '.csv'

    return response.attachment(fullPath, filename)
  }

  async exportStatus(ctx: HttpContext) {
    const { auth, response } = ctx
    const userId = auth.user?.id ?? 0

    const exports = await ReportExport.query()
      .where('user_id', userId)
      .where('created_at', '>=', DateTime.now().minus({ days: 1 }).toSQL()!)
      .orderBy('created_at', 'desc')
      .limit(10)

    return response.json({
      exports: exports.map((e) => this.mapExportForBanner(e, true, true)),
    })
  }

  async dismissExport(ctx: HttpContext) {
    const { params, response, auth, request, session } = ctx
    const exportRow = await ReportExport.find(params.export)
    if (!exportRow) {
      if (request.accepts(['json'])) {
        return response.json({ success: true })
      }
      return response.redirect().back()
    }

    if (exportRow.userId !== auth.user?.id) {
      return response.forbidden('Forbidden')
    }

    await exportRow.delete()

    if (request.accepts(['json'])) {
      return response.json({ success: true })
    }

    session.flash('success', 'Export dismissed.')
    return response.redirect().back()
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async validateExportRequest(
    ctx: HttpContext
  ): Promise<{
    report_type: string
    start_date: string
    end_date: string
    attendant_type?: string | null
  } | null> {
    const raw = { ...ctx.request.qs(), ...ctx.request.body() }
    const validated = await reportExportValidator.validate(raw)

    if (!ReportCatalogue.exportableKeys().includes(validated.report_type)) {
      ctx.session.flash('error', 'Unknown report type.')
      return null
    }

    const start = parseDate(validated.start_date)
    const end = parseDate(validated.end_date)
    if (!start.isValid || !end.isValid || end < start) {
      ctx.session.flash('error', 'The end date must be after or equal to the start date.')
      return null
    }

    const attendant =
      validated.attendant_type && ATTENDANT_TYPES.includes(validated.attendant_type)
        ? validated.attendant_type
        : null

    return {
      report_type: validated.report_type,
      start_date: validated.start_date,
      end_date: validated.end_date,
      attendant_type: attendant,
    }
  }

  private filtersForType(
    reportType: string,
    validated: { start_date: string; end_date: string; attendant_type?: string | null }
  ): ReportFilters {
    const start = validated.start_date
    const end = validated.end_date

    if (reportType === 'opd_register') {
      return { start_date: start, end_date: end, attendant_type: validated.attendant_type ?? null }
    }
    return { start_date: start, end_date: end }
  }

  private hubQuery(reportType: string, filters: ReportFilters): string {
    const params = new URLSearchParams()
    params.set('report_key', reportType)
    if (filters.start_date) params.set('start_date', filters.start_date)
    if (filters.end_date) params.set('end_date', filters.end_date)
    if (filters.attendant_type) params.set('attendant_type', filters.attendant_type)
    return params.toString()
  }

  private async buildPreview(reportType: string, filters: ReportFilters) {
    const start = parseDate(filters.start_date!).startOf('day')
    const end = parseDate(filters.end_date!).endOf('day')
    const period = `${start.toFormat('LLL dd, yyyy')} - ${end.toFormat('LLL dd, yyyy')}`

    switch (reportType) {
      case 'gyn_obs': {
        const payload = await this.gynObs.buildReportPayload(start, end)
        return { kind: 'gyn_obs', title: 'Gyn & OBS Dashboard', period: payload.period, gynObs: payload }
      }
      case 'opd_register': {
        const mapper = new OpdRegisterRowMapper()
        const encounters = await OpdRegisterQuery.build(filters)
          .preload('patient')
          .preload('screeningRecords')
          .preload('labRequests', (lr) =>
            lr.preload('labRequestItems').preload('labResults', (r) => r.preload('labRequestItem'))
          )
          .orderBy('started_at')
          .limit(PREVIEW_LIMIT)
        return this.tablePreview('OPD Register', period, OpdRegisterColumns.headers(), encounters.map((e) => mapper.toRow(e)), encounters.length)
      }
      case 'presumptive_tb': {
        const records = await PresumptiveTbQuery.build(filters)
          .preload('patient')
          .preload('encounter')
          .limit(PREVIEW_LIMIT)
        const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
        const headers = ['Case No', 'Screened At', 'Patient', 'Encounter', 'Constitutional Symptoms', 'Clinician']
        const rows = records.map((r) => [
          r.presumptiveTbCaseNo ?? '',
          r.screeningStartedAt ? fmtYmdHi(r.screeningStartedAt) : '',
          r.patient?.fullName ?? '',
          r.encounter?.encounterNumber ?? '',
          r.constitutionalSymptoms || '',
          clinicians.get(r.clinicianId) ?? '',
        ])
        return this.tablePreview('Presumptive TB Register', period, headers, rows, records.length)
      }
      case 'pnc_register': {
        const mapper = new PncRegisterRowMapper()
        const records = await PncRegisterQuery.build(filters).preload('patient').limit(PREVIEW_LIMIT)
        const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
        const visitCounts = new Map<number, number>()
        const rows = records.map((r) => {
          const count = (visitCounts.get(r.patientId) ?? 0) + 1
          visitCounts.set(r.patientId, count)
          return mapper.toRow(r, count, clinicians.get(r.clinicianId) ?? '')
        })
        return this.tablePreview('PNC Register', period, PncRegisterColumns.headers(), rows, records.length)
      }
      case 'anc_register': {
        const mapper = new AncRegisterRowMapper()
        const records = await AncRegisterQuery.build(filters)
          .preload('patient')
          .preload('encounter', (e) =>
            e.preload('triageRecords').preload('labRequests', (lr) =>
              lr.preload('labRequestItems').preload('labResults', (r) => r.preload('labRequestItem'))
            )
          )
          .limit(PREVIEW_LIMIT)
        const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
        const contactCounts = new Map<number, number>()
        const rows = records.map((r) => {
          const count = (contactCounts.get(r.patientId) ?? 0) + 1
          contactCounts.set(r.patientId, count)
          return mapper.toRow(r, count, clinicians.get(r.clinicianId) ?? '')
        })
        return this.tablePreview('ANC Register', period, AncRegisterColumns.headers(), rows, records.length)
      }
      case 'art_register': {
        const mapper = new ArtRegisterRowMapper()
        const query = ArtRegisterQuery.applyEagerLoads(ArtRegisterQuery.build(filters), filters)
        const patients = await query.limit(PREVIEW_LIMIT)
        const rows = patients.map((p: Patient) => mapper.toRow(p, end))
        return this.tablePreview('ART Register', period, ArtRegisterColumns.headers(), rows, patients.length)
      }
      case 'hia_one_a':
      case 'hia_one_b': {
        const variant = HiaCatalogue.variantFromReportKey(reportType)
        const payload = await new HiaReportAggregator().aggregate(variant, filters)
        return {
          kind: 'hia',
          title: HiaCatalogue.title(variant),
          period: payload.period,
          hia: {
            topDiagnoses: payload.topDiagnoses,
            catalogueRows: HiaCatalogue.count(variant),
            unmatchedEvents: payload.unmatchedEvents,
          },
        }
      }
      default:
        return null
    }
  }

  private tablePreview(
    title: string,
    period: string,
    headers: string[],
    rows: (string | number | null | undefined)[][],
    fetched: number
  ) {
    return {
      kind: 'table' as const,
      title,
      period,
      table: {
        headers,
        rows: rows.map((r) => r.map((v) => (v === null || v === undefined ? '' : v))),
        truncated: fetched >= PREVIEW_LIMIT,
        limit: PREVIEW_LIMIT,
      },
    }
  }

  private async buildCsv(
    reportType: string,
    filters: ReportFilters
  ): Promise<{ filename: string; body: string } | null> {
    const sink = new BufferCsvSink()
    const start = parseDate(filters.start_date!).startOf('day')
    const end = parseDate(filters.end_date!).endOf('day')
    const startYmd = filters.start_date!
    const endYmd = filters.end_date!
    const generated = 'Generated: ' + fmtDMYHi(DateTime.now())

    switch (reportType) {
      case 'gyn_obs':
        sink.write(['BARCODES', 'Gyn & OBS Dashboard'])
        sink.write([generated])
        sink.write([])
        await new GynObsCsvWriter().write(sink, start, end)
        return { filename: `gyn_obs_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }

      case 'opd_register':
        sink.write(['BARCODES', 'OPD Register'])
        sink.write([generated])
        sink.write([])
        await new OpdRegisterCsvWriter().write(sink, filters)
        return { filename: `opd_register_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }

      case 'presumptive_tb': {
        sink.write(['BARCODES', 'Presumptive TB Register', 'Period: ' + PresumptiveTbQuery.periodLabel(filters)])
        sink.write([])
        sink.write(['Case No', 'Screened At', 'Patient', 'Encounter', 'Constitutional Symptoms', 'Clinician'])
        const records = await PresumptiveTbQuery.build(filters).preload('patient').preload('encounter')
        const clinicians = await clinicianNameMap(records.map((r) => r.clinicianId))
        for (const r of records) {
          sink.write([
            r.presumptiveTbCaseNo,
            r.screeningStartedAt ? fmtYmdHi(r.screeningStartedAt) : '',
            r.patient?.fullName ?? '',
            r.encounter?.encounterNumber ?? '',
            r.constitutionalSymptoms || '',
            clinicians.get(r.clinicianId) ?? '',
          ])
        }
        return { filename: `presumptive_tb_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }
      }

      case 'pnc_register':
        sink.write(['BARCODES', 'PNC Register'])
        sink.write([generated])
        sink.write([])
        await new PncRegisterCsvWriter().write(sink, filters)
        return { filename: `pnc_register_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }

      case 'anc_register':
        sink.write(['BARCODES', 'ANC Register'])
        sink.write([generated])
        sink.write([])
        await new AncRegisterCsvWriter().write(sink, filters)
        return { filename: `anc_register_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }

      case 'art_register':
        await new ArtRegisterCsvWriter().write(sink, filters)
        return { filename: `art_register_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }

      case 'hia_one_a':
      case 'hia_one_b': {
        const variant = HiaCatalogue.variantFromReportKey(reportType)
        const payload = await new HiaReportAggregator().aggregate(variant, filters)
        await new HiaRegisterCsvWriter().write(sink, variant, payload, filters)
        return { filename: `${HiaCatalogue.reportKey(variant)}_${startYmd}_${endYmd}.csv`, body: UTF8_BOM + sink.toString() }
      }

      default:
        return null
    }
  }

  private async dispatchCsvExport(ctx: HttpContext, reportType: string, filters: ReportFilters) {
    const estimatedRows = Math.max(1, await this.estimateRowCount(reportType, filters))
    const entry = ReportCatalogue.findByKey(reportType)

    const exportRow = await ReportExport.create({
      userId: ctx.auth.user?.id ?? 0,
      reportType,
      reportName: entry?.name ?? 'Report',
      status: 'pending',
      totalRows: estimatedRows,
      processedRows: 0,
      filters: JSON.stringify({ ...filters, format: 'csv' }),
    })

    const job = new GenerateReportExport(exportRow.id)
    if (reportConfig.processExportsSync) {
      await queue.dispatchSync(job)
    } else {
      await queue.dispatch(job)
    }

    return exportRow
  }

  private async estimateRowCount(reportType: string, filters: ReportFilters): Promise<number> {
    const start = parseDate(filters.start_date!).startOf('day')
    const end = parseDate(filters.end_date!).endOf('day')

    switch (reportType) {
      case 'opd_register':
        return OpdRegisterQuery.count(filters)
      case 'presumptive_tb':
        return PresumptiveTbQuery.count(filters)
      case 'pnc_register':
        return PncRegisterQuery.count(filters)
      case 'anc_register':
        return AncRegisterQuery.count(filters)
      case 'art_register':
        return ArtRegisterQuery.count(filters)
      case 'hia_one_a':
        return HiaCatalogue.count('a')
      case 'hia_one_b':
        return HiaCatalogue.count('b')
      case 'gyn_obs':
        return Math.max(1, await this.gynObs.recordsInPeriodCount(start, end))
      default:
        return 0
    }
  }

  private mapExportForBanner(e: ReportExport, includeDownload = false, includeError = false) {
    const isCompleted = e.status === 'completed'
    const progress = isCompleted
      ? 100
      : e.totalRows > 0
        ? Math.min(100, Math.round((e.processedRows / e.totalRows) * 100))
        : 0

    return {
      id: e.id,
      report_name: e.reportName,
      status: e.status,
      progress,
      total_rows: e.totalRows,
      processed: e.processedRows,
      file_size: this.humanFileSize(e.fileSize),
      download_url: includeDownload && isCompleted ? `/reports/exports/${e.id}/download` : null,
      created_at: e.createdAt ? e.createdAt.toRelative() : null,
      expires_in: e.expiresAt ? e.expiresAt.toRelative() : null,
      error_message: includeError ? e.errorMessage : null,
    }
  }

  private humanFileSize(bytes: number | null): string | null {
    if (bytes === null || bytes === undefined) {
      return null
    }
    if (bytes < 1024) {
      return `${bytes} B`
    }
    const units = ['KB', 'MB', 'GB']
    let size = bytes / 1024
    let unit = 0
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024
      unit++
    }
    return `${size.toFixed(1)} ${units[unit]}`
  }
}
