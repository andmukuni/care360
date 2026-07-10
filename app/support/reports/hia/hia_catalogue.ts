import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface HiaCatalogueEntry {
  name: string
  code: string
}

/**
 * Loads MoH HIA diagnosis line catalogues from committed JSON.
 * Ported from App\Support\Reports\Hia\HiaCatalogue.
 *
 * The JSON files are produced by the `reports:extract-hia-catalogues` ace
 * command into `resources/data/`. If they are absent this returns an empty
 * catalogue (the aggregator then produces a zero-row report).
 */
export class HiaCatalogue {
  private static cache = new Map<string, HiaCatalogueEntry[]>()

  static entries(variant: string): HiaCatalogueEntry[] {
    const file = this.fileFor(variant)
    if (this.cache.has(file)) {
      return this.cache.get(file)!
    }

    const path = join(process.cwd(), 'resources', 'data', file)
    let entries: HiaCatalogueEntry[] = []
    if (existsSync(path)) {
      try {
        const decoded = JSON.parse(readFileSync(path, 'utf-8'))
        entries = Array.isArray(decoded) ? decoded : []
      } catch {
        entries = []
      }
    }

    this.cache.set(file, entries)
    return entries
  }

  static count(variant: string): number {
    return this.entries(variant).length
  }

  static title(variant: string): string {
    switch (variant) {
      case 'a':
      case 'hia_one_a':
        return 'Ministry of Health HIA 1 A'
      case 'b':
      case 'hia_one_b':
        return 'Ministry of Health HIA 1 B'
      default:
        return 'HIA Report'
    }
  }

  static reportKey(variant: string): string {
    switch (variant) {
      case 'a':
        return 'hia_one_a'
      case 'b':
        return 'hia_one_b'
      default:
        return variant
    }
  }

  static variantFromReportKey(reportKey: string): string {
    switch (reportKey) {
      case 'hia_one_a':
        return 'a'
      case 'hia_one_b':
        return 'b'
      default:
        throw new Error('Unknown HIA report key: ' + reportKey)
    }
  }

  private static fileFor(variant: string): string {
    switch (variant) {
      case 'a':
      case 'hia_one_a':
        return 'hia-one-a-catalogue.json'
      case 'b':
      case 'hia_one_b':
        return 'hia-one-b-catalogue.json'
      default:
        throw new Error('Unknown HIA variant: ' + variant)
    }
  }
}
