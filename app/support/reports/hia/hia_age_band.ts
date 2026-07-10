import { DateTime } from 'luxon'
import { ageInYears } from '../support.js'

/**
 * MoH HIA age bands for OPD / IPD / Death columns.
 * Ported from App\Support\Reports\Hia\HiaAgeBand.
 */
export class HiaAgeBand {
  static readonly U1 = 'u1'
  static readonly Y1_4 = '1_4'
  static readonly Y5_14 = '5_14'
  static readonly Y15_PLUS = '15_plus'
  static readonly TOTAL = 'total'

  static bands(): string[] {
    return [this.U1, this.Y1_4, this.Y5_14, this.Y15_PLUS]
  }

  static resolve(dateOfBirth: DateTime | null, eventDate: DateTime): string | null {
    if (!dateOfBirth) {
      return null
    }
    if (dateOfBirth > eventDate) {
      return null
    }

    const years = ageInYears(dateOfBirth, eventDate) ?? 0

    if (years < 1) {
      return this.U1
    }
    if (years <= 4) {
      return this.Y1_4
    }
    if (years <= 14) {
      return this.Y5_14
    }
    return this.Y15_PLUS
  }
}
