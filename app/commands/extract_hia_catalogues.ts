import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { HiaCatalogueEntry } from '#support/reports/hia/hia_catalogue'
import { extractHiaPairs, readZipEntries } from '#support/reports/hia/xlsx_reader'

/**
 * reports:extract-hia-catalogues
 *
 * Extracts HIA 1A/1B diagnosis catalogues from the MoH xlsx templates into
 * resources/data JSON. Ported from the Laravel Artisan command; the ZipArchive
 * + SimpleXML logic is reimplemented dependency-free (see xlsx_reader.ts).
 *
 * Source templates are expected at:
 *   docs/Reports/HIA_One_A_May26.xlsx  (sheet "HIA 1A")
 *   docs/Reports/HIA_One_B_May26.xlsx  (sheet "HIA 1B")
 * If a template is missing the command reports it and skips that variant.
 */
export default class ExtractHiaCatalogues extends BaseCommand {
  static commandName = 'reports:extract-hia-catalogues'
  static description =
    'Extract HIA 1A/1B diagnosis catalogues from MoH xlsx templates into resources/data JSON.'
  static options: CommandOptions = {}

  async run(): Promise<void> {
    const outDir = join(process.cwd(), 'resources', 'data')
    mkdirSync(outDir, { recursive: true })

    const a = this.extract('docs/Reports/HIA_One_A_May26.xlsx', 'HIA 1A')
    const b = this.extract('docs/Reports/HIA_One_B_May26.xlsx', 'HIA 1B')

    if (a !== null) {
      writeFileSync(join(outDir, 'hia-one-a-catalogue.json'), JSON.stringify(a, null, 2))
    }
    if (b !== null) {
      writeFileSync(join(outDir, 'hia-one-b-catalogue.json'), JSON.stringify(b, null, 2))
    }

    this.logger.info(
      `Wrote ${a?.length ?? 0} HIA 1A and ${b?.length ?? 0} HIA 1B catalogue entries.`
    )
  }

  private extract(relativePath: string, sheetName: string): HiaCatalogueEntry[] | null {
    const path = join(process.cwd(), relativePath)
    if (!existsSync(path)) {
      this.logger.warning(`Template not found, skipping ${sheetName}: ${relativePath}`)
      return null
    }

    try {
      const entries = readZipEntries(readFileSync(path))
      return extractHiaPairs(entries, sheetName)
    } catch (error) {
      this.logger.error(`Failed to extract ${sheetName}: ${(error as Error).message}`)
      return null
    }
  }
}
