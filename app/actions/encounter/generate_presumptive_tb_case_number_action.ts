import { DateTime } from 'luxon'
import ScreeningRecord from '#models/screening_record'

/**
 * Generates a sequential presumptive TB case number: TB-YYYYMMDD-0001.
 * Ported from App\Actions\Encounter\GeneratePresumptiveTbCaseNumberAction.
 */
export default class GeneratePresumptiveTbCaseNumberAction {
  async handle(date: DateTime | null = null): Promise<string> {
    const day = date ?? DateTime.now()
    const prefix = `TB-${day.toFormat('yyyyLLdd')}-`

    const latest = await ScreeningRecord.query()
      .where('presumptive_tb_case_no', 'like', `${prefix}%`)
      .orderBy('id', 'desc')
      .first()

    const latestNumber = latest?.presumptiveTbCaseNo ?? null
    const seq = latestNumber ? Number.parseInt(latestNumber.slice(-4), 10) + 1 : 1

    return prefix + String(seq).padStart(4, '0')
  }
}
