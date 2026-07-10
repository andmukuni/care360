import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import Patient from '#models/patient'
import ScreeningRecord from '#models/screening_record'
import { chunkQuery, fmtMdY, parseDate, type ReportFilters } from '../support.js'
import { HiaAgeBand } from './hia_age_band.js'
import { HiaCatalogue, type HiaCatalogueEntry } from './hia_catalogue.js'
import { HiaDiagnosisMatcher } from './hia_diagnosis_matcher.js'
import { HiaCounts, HiaReportPayload, HiaTopDiagnosis } from './hia_report_payload.js'

/**
 * Aggregates OPD first attendance, IPD discharge, and death events into HIA age-band counts.
 * Ported from App\Support\Reports\Hia\HiaReportAggregator.
 */
export class HiaReportAggregator {
  async aggregate(variant: string, filters: ReportFilters): Promise<HiaReportPayload> {
    const catalogue = HiaCatalogue.entries(variant)
    const matcher = new HiaDiagnosisMatcher(catalogue)
    const counts = this.emptyCounts(catalogue)
    let unmatched = 0

    const start = parseDate(filters.start_date ?? DateTime.now().startOf('month').toISODate()!).startOf(
      'day'
    )
    const end = parseDate(filters.end_date ?? DateTime.now().toISODate()!).endOf('day')

    unmatched += await this.collectOpdFirstAttendance(matcher, counts, start, end)
    unmatched += await this.collectIpdDischarge(matcher, counts, start, end)
    unmatched += await this.collectDeaths(matcher, counts, start, end)

    const period = `${fmtMdY(start)} - ${fmtMdY(end)}`
    const topDiagnoses = this.buildTopDiagnoses(catalogue, counts)

    return new HiaReportPayload(
      variant,
      HiaCatalogue.title(variant),
      period,
      counts,
      topDiagnoses,
      unmatched
    )
  }

  private emptyCounts(catalogue: HiaCatalogueEntry[]): HiaCounts {
    const counts: HiaCounts = {}
    for (const entry of catalogue) {
      counts[entry.code] = {
        [HiaReportPayload.SECTION_OPD]: this.emptyBandRow(),
        [HiaReportPayload.SECTION_IPD]: this.emptyBandRow(),
        [HiaReportPayload.SECTION_DEATH]: this.emptyBandRow(),
      }
    }
    return counts
  }

  private emptyBandRow(): Record<string, number> {
    const row: Record<string, number> = {}
    for (const band of HiaAgeBand.bands()) {
      row[band] = 0
    }
    return row
  }

  private async increment(
    matcher: HiaDiagnosisMatcher,
    counts: HiaCounts,
    section: string,
    dob: DateTime | null,
    eventDate: DateTime,
    diagnosisRaw: string | null | undefined
  ): Promise<boolean> {
    const code = await matcher.matchCode(diagnosisRaw)
    if (code === null || !counts[code]) {
      return false
    }

    const band = HiaAgeBand.resolve(dob, eventDate)
    if (band === null) {
      return false
    }

    counts[code][section][band]++
    return true
  }

  private async collectOpdFirstAttendance(
    matcher: HiaDiagnosisMatcher,
    counts: HiaCounts,
    start: DateTime,
    end: DateTime
  ): Promise<number> {
    let unmatched = 0

    const query = Encounter.query()
      .where('visit_type', 'OPD')
      .whereBetween('started_at', [start.toSQL()!, end.toSQL()!])
      .whereHas('registrationRecords', (q) => q.where('was_existing_patient', false))
      .preload('patient')
      .preload('screeningRecords')
      .orderBy('id')

    await chunkQuery<Encounter>(query, 500, async (encounters) => {
      for (const encounter of encounters) {
        const screening = encounter.screeningRecords?.[0] ?? null
        const diag = screening?.finalDiagnosis || screening?.provisionalDiagnosis
        if (!diag) {
          continue
        }
        const eventDate = encounter.startedAt ?? DateTime.now()
        if (
          !(await this.increment(
            matcher,
            counts,
            HiaReportPayload.SECTION_OPD,
            encounter.patient?.dateOfBirth ?? null,
            eventDate,
            diag
          ))
        ) {
          unmatched++
        }
      }
    })

    return unmatched
  }

  private async collectIpdDischarge(
    matcher: HiaDiagnosisMatcher,
    counts: HiaCounts,
    start: DateTime,
    end: DateTime
  ): Promise<number> {
    let unmatched = 0

    const query = Encounter.query()
      .where('visit_type', 'Admission')
      .whereNotNull('closed_at')
      .whereBetween('closed_at', [start.toSQL()!, end.toSQL()!])
      .preload('patient')
      .preload('screeningRecords')
      .orderBy('id')

    await chunkQuery<Encounter>(query, 500, async (encounters) => {
      for (const encounter of encounters) {
        const screening = encounter.screeningRecords?.[0] ?? null
        const diag = screening?.finalDiagnosis || screening?.provisionalDiagnosis
        if (!diag) {
          continue
        }
        const eventDate = encounter.closedAt ?? DateTime.now()
        if (
          !(await this.increment(
            matcher,
            counts,
            HiaReportPayload.SECTION_IPD,
            encounter.patient?.dateOfBirth ?? null,
            eventDate,
            diag
          ))
        ) {
          unmatched++
        }
      }
    })

    return unmatched
  }

  private async collectDeaths(
    matcher: HiaDiagnosisMatcher,
    counts: HiaCounts,
    start: DateTime,
    end: DateTime
  ): Promise<number> {
    let unmatched = 0

    const query = Patient.query()
      .where('is_deceased', true)
      .whereNotNull('deceased_at')
      .whereBetween('deceased_at', [start.toFormat('yyyy-MM-dd'), end.toFormat('yyyy-MM-dd')])
      .orderBy('id')

    await chunkQuery<Patient>(query, 500, async (patients) => {
      for (const patient of patients) {
        const screening = await ScreeningRecord.query()
          .where('patient_id', patient.id)
          .whereRaw('COALESCE(screening_started_at, created_at) BETWEEN ? AND ?', [
            start.toSQL()!,
            end.toSQL()!,
          ])
          .orderByRaw('COALESCE(screening_started_at, created_at) DESC')
          .first()

        const diag = screening?.finalDiagnosis || screening?.provisionalDiagnosis
        if (!diag) {
          continue
        }

        const eventDate = patient.deceasedAt ?? DateTime.now()

        if (
          !(await this.increment(
            matcher,
            counts,
            HiaReportPayload.SECTION_DEATH,
            patient.dateOfBirth ?? null,
            eventDate,
            diag
          ))
        ) {
          unmatched++
        }
      }
    })

    return unmatched
  }

  private buildTopDiagnoses(catalogue: HiaCatalogueEntry[], counts: HiaCounts): HiaTopDiagnosis[] {
    const payload = new HiaReportPayload('a', '', '', counts, [], 0)
    const rows: HiaTopDiagnosis[] = []

    for (const entry of catalogue) {
      const code = entry.code
      const opd = payload.sectionTotal(code, HiaReportPayload.SECTION_OPD)
      const ipd = payload.sectionTotal(code, HiaReportPayload.SECTION_IPD)
      const death = payload.sectionTotal(code, HiaReportPayload.SECTION_DEATH)
      if (opd + ipd + death === 0) {
        continue
      }
      rows.push({
        name: entry.name,
        code,
        opd_total: opd,
        ipd_total: ipd,
        death_total: death,
      })
    }

    rows.sort(
      (a, b) =>
        b.opd_total +
        b.ipd_total +
        b.death_total -
        (a.opd_total + a.ipd_total + a.death_total)
    )

    return rows.slice(0, 50)
  }

  static periodLabel(filters: ReportFilters): string {
    if (filters.start_date && filters.end_date) {
      return `${fmtMdY(parseDate(filters.start_date))} - ${fmtMdY(parseDate(filters.end_date))}`
    }
    return 'All records'
  }
}
