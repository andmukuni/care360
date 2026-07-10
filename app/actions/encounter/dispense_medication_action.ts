import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import Medication from '#models/medication'
import PharmacyDispense from '#models/pharmacy_dispense'
import PharmacyDispenseItem from '#models/pharmacy_dispense_item'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getLatestPrescription } from '#services/encounter/encounter_records'

/**
 * Records medication dispensing against the active prescription. Works directly
 * on the encounter; does NOT advance the stage.
 * Ported from App\Actions\Encounter\DispenseMedicationAction.
 */
export default class DispenseMedicationAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly lockService = new EncounterLockService()

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    pharmacistId: number
  ): Promise<PharmacyDispense> {
    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Pharmacy)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const prescription = await getLatestPrescription(encounter.id, trx)

      const dispense = await PharmacyDispense.create(
        {
          encounterId: encounter.id,
          patientId: encounter.patientId,
          pharmacyPrescriptionId: prescription?.id ?? null,
          dispensedBy: pharmacistId,
          dispensingNotes: data.dispensing_notes ?? null,
          counselingNotes: data.counseling_notes ?? null,
          dispensedAt: DateTime.now(),
        },
        { client: trx }
      )

      for (const item of data.items ?? []) {
        const quantity = Number(item.quantity_dispensed)
        const medicationId = item.medication_id ?? null

        await PharmacyDispenseItem.create(
          {
            pharmacyDispenseId: dispense.id,
            pharmacyPrescriptionItemId: item.pharmacy_prescription_item_id ?? null,
            medicationId,
            drugName: item.drug_name,
            quantityDispensed: quantity,
            batchNo: item.batch_no ?? null,
            stockReference: item.stock_reference ?? null,
            instructions: item.instructions ?? null,
          },
          { client: trx }
        )

        // If linked to the medications master, decrement stock_on_hand.
        if (medicationId) {
          const medication = await Medication.query({ client: trx })
            .where('id', medicationId)
            .forUpdate()
            .first()
          if (medication && medication.stockOnHand !== null) {
            medication.useTransaction(trx)
            medication.stockOnHand = medication.stockOnHand - quantity
            await medication.save()
          }
        }
      }

      // Mark prescription dispensed only when every line has been dispensed.
      if (prescription) {
        prescription.useTransaction(trx)
        const rxItems = await PharmacyPrescriptionItem.query({ client: trx }).where(
          'pharmacy_prescription_id',
          prescription.id
        )

        const dispensedItemIds = new Set<number>()
        const encounterDispenses = await PharmacyDispense.query({ client: trx })
          .where('encounter_id', encounter.id)
          .preload('pharmacyDispenseItems')

        for (const record of encounterDispenses) {
          for (const dispenseItem of record.pharmacyDispenseItems) {
            if (dispenseItem.pharmacyPrescriptionItemId) {
              dispensedItemIds.add(dispenseItem.pharmacyPrescriptionItemId)
            }
          }
        }

        const allDispensed =
          rxItems.length > 0 && rxItems.every((item) => dispensedItemIds.has(item.id))
        prescription.status = allDispensed ? 'dispensed' : 'active'
        await prescription.save()
      }

      return dispense
    })
  }
}
