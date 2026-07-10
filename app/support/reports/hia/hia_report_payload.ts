import { HiaAgeBand } from './hia_age_band.js'

export interface HiaTopDiagnosis {
  name: string
  code: string
  opd_total: number
  ipd_total: number
  death_total: number
}

export type HiaCounts = Record<string, Record<string, Record<string, number>>>

/**
 * Aggregated HIA counts: [canonical_code][section][band] => int.
 * Ported from App\Support\Reports\Hia\HiaReportPayload.
 */
export class HiaReportPayload {
  static readonly SECTION_OPD = 'opd'
  static readonly SECTION_IPD = 'ipd'
  static readonly SECTION_DEATH = 'death'

  constructor(
    public readonly variant: string,
    public readonly title: string,
    public readonly period: string,
    public readonly counts: HiaCounts,
    public readonly topDiagnoses: HiaTopDiagnosis[],
    public readonly unmatchedEvents: number
  ) {}

  getCount(code: string, section: string, band: string): number {
    return this.counts[code]?.[section]?.[band] ?? 0
  }

  sectionTotal(code: string, section: string): number {
    let sum = 0
    for (const band of HiaAgeBand.bands()) {
      sum += this.getCount(code, section, band)
    }
    return sum
  }

  rowHasActivity(code: string): boolean {
    for (const section of [
      HiaReportPayload.SECTION_OPD,
      HiaReportPayload.SECTION_IPD,
      HiaReportPayload.SECTION_DEATH,
    ]) {
      if (this.sectionTotal(code, section) > 0) {
        return true
      }
    }
    return false
  }
}
