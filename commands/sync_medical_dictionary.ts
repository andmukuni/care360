import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import MedicalDictionaryService from '#services/clinical/medical_dictionary_service'

/**
 * dictionary:sync
 *
 * Re-syncs medical dictionary terms from ICD-11, NTG, medications, lab catalogs,
 * and symptom seeds. Preserves manually edited definitions on existing rows.
 */
export default class SyncMedicalDictionary extends BaseCommand {
  static commandName = 'dictionary:sync'
  static description =
    'Sync medical dictionary terms from ICD-11, NTG, medications, lab catalogs, and symptoms.'
  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Only sync ICD-11 diagnoses' })
  declare icd11Only: boolean

  @flags.boolean({ description: 'Only sync medications (drugs)' })
  declare drugsOnly: boolean

  @flags.boolean({ description: 'Only sync lab tests' })
  declare labOnly: boolean

  async run(): Promise<void> {
    const hasTable = await db.connection().schema.hasTable('medical_dictionary_terms')
    if (!hasTable) {
      this.logger.error('Table medical_dictionary_terms does not exist. Run migrations first.')
      this.exitCode = 1
      return
    }

    const log = (msg: string) => this.logger.info(msg)

    if (this.icd11Only) {
      await MedicalDictionaryService.syncIcd11(log)
      return
    }
    if (this.drugsOnly) {
      await MedicalDictionaryService.syncMedications(log)
      return
    }
    if (this.labOnly) {
      await MedicalDictionaryService.syncLab(log)
      return
    }

    const result = await MedicalDictionaryService.syncAll({ logger: log })
    this.logger.success(
      `Done. ICD-11=${result.icd11} NTG=${result.ntg} drugs=${result.medications} lab=${result.lab} symptoms=${result.symptoms}`
    )
  }
}
