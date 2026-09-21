import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ClosePharmacyEncountersWithoutPrescriptionService from '#services/encounter/close_pharmacy_encounters_without_prescription_service'

/**
 * Close leftover Pharmacy queue rows that have no prescription medication.
 *
 *   node ace pharmacy:close-empty-queue
 *   node ace pharmacy:close-empty-queue --dry-run
 */
export default class ClosePharmacyEncountersWithoutPrescription extends BaseCommand {
  static commandName = 'pharmacy:close-empty-queue'
  static description =
    'Close Pharmacy-queued encounters that have no prescription medication'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'List matching encounters without closing them' })
  declare dryRun: boolean

  async run() {
    const closed = await new ClosePharmacyEncountersWithoutPrescriptionService().handle({
      dryRun: this.dryRun,
    })

    if (closed.length === 0) {
      this.logger.info('No open Pharmacy encounters without prescription medication.')
      return
    }

    const verb = this.dryRun ? 'Would close' : 'Closed'
    this.logger.info(`${verb} ${closed.length} Pharmacy encounter(s) without prescription medication:`)
    for (const row of closed) {
      this.logger.info(`  ${row.encounterNumber} (#${row.id})`)
    }
  }
}
