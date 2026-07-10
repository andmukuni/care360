import { inflateRawSync } from 'node:zlib'
import type { HiaCatalogueEntry } from './hia_catalogue.js'

/**
 * Dependency-free reader for the small slice of the XLSX (OOXML) format needed
 * to extract MoH HIA 1A/1B diagnosis catalogues. XLSX files are ZIP archives;
 * this reads the central directory, inflates deflate-compressed members, and
 * walks the shared-strings + worksheet XML with regexes (mirroring the PHP
 * ZipArchive + SimpleXML approach in reports:extract-hia-catalogues).
 */

export function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()

  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) {
    return entries
  }

  const count = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)

  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) {
      break
    }
    const method = buf.readUInt16LE(offset + 10)
    const compSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen)

    const lhNameLen = buf.readUInt16LE(localOffset + 26)
    const lhExtraLen = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen
    const compData = buf.subarray(dataStart, dataStart + compSize)

    try {
      const data = method === 8 ? inflateRawSync(compData) : Buffer.from(compData)
      entries.set(name, data)
    } catch {
      // skip unreadable member
    }

    offset += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

function parseSharedStrings(xml: string): string[] {
  const shared: string[] = []
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const inner = si[1]
    let joined = ''
    for (const t of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
      joined += t[1]
    }
    shared.push(decodeXml(joined))
  }
  return shared
}

function columnToIndex(ref: string): number | null {
  const match = ref.match(/^([A-Z]+)/)
  if (!match) {
    return null
  }
  const col = match[1]
  let idx = 0
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64)
  }
  return idx - 1
}

/**
 * Extract `{ name, code }` pairs from a named worksheet, matching the PHP
 * command: skips the first 8 header rows and reads columns B (name) and C (code).
 */
export function extractHiaPairs(entries: Map<string, Buffer>, sheetName: string): HiaCatalogueEntry[] {
  const sharedXml = entries.get('xl/sharedStrings.xml')?.toString('utf8') ?? ''
  const shared = parseSharedStrings(sharedXml)

  const wbXml = entries.get('xl/workbook.xml')?.toString('utf8') ?? ''
  const relsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? ''

  const relMap = new Map<string, string>()
  for (const rel of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = rel[0]
    const id = tag.match(/Id="([^"]+)"/)?.[1]
    const target = tag.match(/Target="([^"]+)"/)?.[1]
    if (id && target) {
      relMap.set(id, 'xl/' + target.replace(/^\/?/, ''))
    }
  }

  let sheetPath: string | null = null
  for (const sheet of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = sheet[0]
    const name = tag.match(/name="([^"]+)"/)?.[1]
    if (name !== sheetName) {
      continue
    }
    const rid = tag.match(/r:id="([^"]+)"/)?.[1]
    if (rid && relMap.has(rid)) {
      sheetPath = relMap.get(rid)!
    }
    break
  }

  if (!sheetPath) {
    throw new Error('Sheet not found: ' + sheetName)
  }

  const sheetXml = entries.get(sheetPath)?.toString('utf8')
  if (!sheetXml) {
    throw new Error('Sheet not found: ' + sheetName)
  }

  const pairs: HiaCatalogueEntry[] = []
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = rowMatch[1]
    const rowNum = Number(rowAttrs.match(/\br="(\d+)"/)?.[1] ?? '0')
    if (rowNum < 9) {
      continue
    }

    const by: Record<number, string> = {}
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const ref = attrs.match(/\br="([^"]+)"/)?.[1]
      if (!ref) {
        continue
      }
      const idx = columnToIndex(ref)
      if (idx === null) {
        continue
      }
      const t = attrs.match(/\bt="([^"]+)"/)?.[1] ?? ''
      const rawMatch = cellMatch[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)
      if (!rawMatch) {
        continue
      }
      const raw = decodeXml(rawMatch[1])
      by[idx] = t === 's' ? shared[Number(raw)] ?? '' : raw
    }

    if (by[1] === undefined || by[2] === undefined) {
      continue
    }
    const name = by[1].trim()
    const code = by[2].trim()
    if (name === '' || code === '' || name === 'Code') {
      continue
    }
    if (!/^[0-9A-Za-z]/.test(code)) {
      continue
    }
    pairs.push({ name, code })
  }

  return pairs
}
