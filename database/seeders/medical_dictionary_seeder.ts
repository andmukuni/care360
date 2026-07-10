import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import MedicalDictionaryService from '#services/clinical/medical_dictionary_service'

/**
 * Seeds medical_dictionary_terms from ICD-11, NTG, medications, lab catalogs, and symptoms.
 * Safe to re-run: upserts by (domain, source, source_id) and preserves manual definitions.
 */
export default class MedicalDictionarySeeder extends BaseSeeder {
  async run() {
    const hasTable = await db.connection().schema.hasTable('medical_dictionary_terms')
    if (!hasTable) {
      console.warn('medical_dictionary_terms table missing — run migrations first.')
      return
    }

    await MedicalDictionaryService.syncAll({
      logger: (msg) => console.log(`[dictionary] ${msg}`),
    })
  }
}
