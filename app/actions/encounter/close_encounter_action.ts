import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import PharmacyDispenseItem from '#models/pharmacy_dispense_item'
import User from '#models/user'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterNotifier } from '#services/encounter/encounter_notifier'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getLatestDispense } from '#services/encounter/encounter_records'
import type { EncounterBillingServiceContract } from '#services/encounter/external_contracts'

/**
 * Closes an encounter permanently (from Pharmacy).
 * Ported from App\Actions\Encounter\CloseEncounterAction.
 *
 * `encounterBilling` is a cross-phase (Billing) dependency; when not injected,
 * the billing/wellness-fund reconciliation step is skipped.
 */
export default class CloseEncounterAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()
  private readonly lockService = new EncounterLockService()
  private readonly queueService = new EncounterQueueService()
  private readonly notifier = new EncounterNotifier()

  constructor(private readonly encounterBilling?: EncounterBillingServiceContract) {}

  async handle(
    encounter: Encounter,
    pharmacistId: number,
    closureNotes: string | null = null
  ): Promise<void> {
    await db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Pharmacy)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      // Guard: a dispense with items must exist.
      const dispense = await getLatestDispense(encounter.id, trx)
      const hasItems = dispense
        ? (await PharmacyDispenseItem.query({ client: trx })
            .where('pharmacy_dispense_id', dispense.id)
            .first()) !== null
        : false

      if (!dispense || !hasItems) {
        throw new Error('Medication must be dispensed before the encounter can be closed.')
      }

      // 1. Complete the open queue transition for pharmacy.
      const openTransition = await this.queueService.getOpenTransition(encounter, trx)
      if (openTransition) {
        await this.queueService.complete(openTransition, trx)
      }

      // 2. Close the pharmacy stage log.
      await this.workflowService.completeStageLog(encounter, pharmacistId, closureNotes, trx)

      // 3. Bill encounter services and reconcile against wellness fund tier.
      if (this.encounterBilling) {
        encounter.useTransaction(trx)
        await encounter.load('patient')
        await encounter.load('labRequests', (q) => q.preload('labRequestItems'))
        await encounter.load('pharmacyDispenses', (q) => q.preload('pharmacyDispenseItems'))
        const user = await User.find(pharmacistId, { client: trx })
        await this.encounterBilling.billEncounter(encounter, user)
      }

      // 4. Mark encounter as completed.
      encounter.useTransaction(trx)
      encounter.currentStage = EncounterStage.Completed
      encounter.currentStatus = EncounterStatus.Completed
      encounter.closedAt = DateTime.now()
      encounter.closedBy = pharmacistId
      encounter.closureNotes = closureNotes
      await encounter.save()

      // 5. Hard lock — no further edits allowed.
      await this.lockService.lock(encounter, trx)

      // 6. Audit.
      await this.auditService.record({
        encounter,
        actionName: 'encounter_closed',
        actionStage: EncounterStage.Pharmacy,
        actionBy: pharmacistId,
        notes: closureNotes,
        client: trx,
      })
    })

    await this.notifier.notifyClosure(encounter, pharmacistId)
  }
}
