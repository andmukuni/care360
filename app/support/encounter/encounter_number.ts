import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export function encounterNumberPrefix(at: DateTime = DateTime.now()): string {
  return `ENC-${at.toFormat('yyyyLLdd')}-`
}

export function formatEncounterNumber(prefix: string, sequence: number): string {
  return prefix + String(sequence).padStart(5, '0')
}

/**
 * Next daily sequence for encounter numbers. Uses MAX suffix for the day —
 * not latest row id — so imported/out-of-order ids cannot reuse a number.
 */
export async function nextEncounterSequence(
  client: TransactionClientContract,
  prefix: string
): Promise<number> {
  const row = await client
    .from('encounters')
    .where('encounter_number', 'like', `${prefix}%`)
    .select(client.raw(`COALESCE(MAX(CAST(RIGHT(encounter_number, 5) AS INTEGER)), 0) AS max_seq`))
    .first()

  const maxSeq = Number((row as { max_seq?: number | string } | undefined)?.max_seq ?? 0)
  return (Number.isFinite(maxSeq) ? maxSeq : 0) + 1
}

export async function generateEncounterNumber(
  client: TransactionClientContract,
  at: DateTime = DateTime.now()
): Promise<string> {
  const prefix = encounterNumberPrefix(at)
  const sequence = await nextEncounterSequence(client, prefix)
  return formatEncounterNumber(prefix, sequence)
}

export function isUniqueEncounterNumberViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = (error as { code?: string }).code
  const constraint = String((error as { constraint?: string }).constraint ?? '')
  const message = String((error as { message?: string }).message ?? '')

  return (
    code === '23505' &&
    (constraint.includes('encounter_number') || message.includes('encounter_number'))
  )
}
