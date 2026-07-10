import { DateTime } from 'luxon'
import User from '#models/user'

/**
 * Shared helpers for the reports subsystem: CSV writing (manual, dep-free),
 * luxon date formatting mirroring the Laravel/Carbon `format()` tokens used by
 * the original exporters, and a Lucid query chunking helper.
 */

export interface ReportFilters {
  date?: string
  start_date?: string
  end_date?: string
  attendant_type?: string | null
  format?: string
}

export type CsvValue = string | number | null | undefined

/**
 * A destination for CSV rows. `BufferCsvSink` accumulates rows in memory (used
 * for streamed downloads / previews) and `StreamCsvSink` writes straight to a
 * Node writable stream (used by the background export job).
 */
export interface CsvSink {
  write(fields: CsvValue[]): void
}

function csvField(value: CsvValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  const s = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function csvRow(fields: CsvValue[]): string {
  return fields.map(csvField).join(',') + '\n'
}

export class BufferCsvSink implements CsvSink {
  private readonly parts: string[] = []

  write(fields: CsvValue[]): void {
    this.parts.push(csvRow(fields))
  }

  toString(): string {
    return this.parts.join('')
  }
}

export class StreamCsvSink implements CsvSink {
  constructor(private readonly stream: { write(chunk: string): unknown }) {}

  write(fields: CsvValue[]): void {
    this.stream.write(csvRow(fields))
  }
}

/** UTF-8 byte order mark, prepended so Excel opens the CSV as UTF-8. */
export const UTF8_BOM = '\uFEFF'

// ─── Date helpers (mirror the Carbon format tokens used by the PHP exporters) ─

export function parseDate(value: string | DateTime): DateTime {
  if (value instanceof DateTime) {
    return value
  }
  let dt = DateTime.fromISO(value)
  if (!dt.isValid) {
    dt = DateTime.fromSQL(value)
  }
  return dt
}

/** PHP `Y-m-d` */
export function fmtYmd(dt: DateTime): string {
  return dt.toFormat('yyyy-MM-dd')
}

/** PHP `n/j/Y` (no leading zeros) */
export function fmtNjY(dt: DateTime): string {
  return dt.toFormat('M/d/yyyy')
}

/** PHP `M d, Y` */
export function fmtMdY(dt: DateTime): string {
  return dt.toFormat('LLL dd, yyyy')
}

/** PHP `d-m-Y` */
export function fmtDmY(dt: DateTime): string {
  return dt.toFormat('dd-MM-yyyy')
}

/** PHP `d M Y H:i` */
export function fmtDMYHi(dt: DateTime): string {
  return dt.toFormat('dd LLL yyyy HH:mm')
}

/** PHP `Y-m-d H:i` */
export function fmtYmdHi(dt: DateTime): string {
  return dt.toFormat('yyyy-MM-dd HH:mm')
}

/** PHP `H:i` */
export function fmtHi(dt: DateTime): string {
  return dt.toFormat('HH:mm')
}

export function ageInYears(dob: DateTime | null | undefined, on: DateTime): number | null {
  if (!dob) {
    return null
  }
  if (dob > on) {
    return null
  }
  return Math.floor(on.diff(dob, 'years').years)
}

export function diffInDays(from: DateTime, to: DateTime): number {
  return Math.floor(to.diff(from, 'days').days)
}

export function diffInMonths(from: DateTime, to: DateTime): number {
  return Math.floor(to.diff(from, 'months').months)
}

/**
 * Minimal port of Laravel's `filled()` — treats null/undefined/'' as blank.
 */
export function filled(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim() !== ''
  }
  return true
}

/**
 * Iterate a Lucid query in chunks. Mirrors Eloquent's `->chunk()` /
 * `->chunkById()` by paging through the (cloned) query with offset/limit.
 */
/**
 * Resolve a set of clinician (user) ids to their display names. The
 * ScreeningRecord model has no `clinician` relation, so register writers build
 * this lookup per chunk and pass the resolved name to the row mapper.
 */
export async function clinicianNameMap(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number'))]
  const map = new Map<number, string>()
  if (unique.length === 0) {
    return map
  }
  const users = await User.query().whereIn('id', unique).select('id', 'name')
  for (const user of users) {
    map.set(user.id, user.name)
  }
  return map
}

export async function chunkQuery<T>(
  query: { clone(): { offset(n: number): any; limit(n: number): any } },
  size: number,
  handler: (rows: T[]) => Promise<void> | void
): Promise<void> {
  let page = 0
  for (;;) {
    const rows = (await query.clone().offset(page * size).limit(size)) as T[]
    if (rows.length === 0) {
      break
    }
    await handler(rows)
    if (rows.length < size) {
      break
    }
    page++
  }
}
