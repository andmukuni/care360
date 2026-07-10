import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type Encounter from '#models/encounter'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterLockService } from '#services/encounter/encounter_lock_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import { getLatestPrescription } from '#services/encounter/encounter_records'
import { FormulationNormalizer } from '#support/encounter/formulation_normalizer'
import { toDateTime } from '#support/encounter/coerce'
import { parsePasserBy } from '#support/encounter/prescription_item_payload'

/**
 * Appends new items to the encounter's active prescription while the visit is
 * still open at pharmacy — including after an initial dispense.
 */
export default class AppendPharmacyPrescriptionItemsAction {
  private readonly workflowService = new EncounterWorkflowService()
  private readonly lockService = new EncounterLockService()

  async handle(encounter: Encounter, items: Record<string, any>[], _prescribedById: number) {
    if (!items.length) {
      throw new Error('Add at least one medication.')
    }

    return db.transaction(async (trx) => {
      this.lockService.assertNotLocked(encounter)
      this.workflowService.assertStageIs(encounter, EncounterStage.Pharmacy)
      this.workflowService.assertStatusIs(encounter, EncounterStatus.InProgress)

      const prescription = await getLatestPrescription(encounter.id, trx)
      if (!prescription) {
        throw new Error('No prescription found for this encounter.')
      }

      prescription.useTransaction(trx)

      for (const item of items) {
        await PharmacyPrescriptionItem.create(
          {
            pharmacyPrescriptionId: prescription.id,
            drugName: item.drug_name,
            strength: item.strength ?? null,
            formulation: FormulationNormalizer.normalize(item.formulation ?? null) ?? null,
            dose: (item.dose ?? null) as string,
            itemPerDose:
              item.item_per_dose !== undefined && item.item_per_dose !== null
                ? Number(item.item_per_dose)
                : null,
            frequency: (item.frequency ?? null) as string,
            timePer: item.time_per ?? null,
            frequencyUnit: item.frequency_unit ?? null,
            duration: (item.duration ?? null) as string,
            durationUnit: item.duration_unit ?? null,
            startDate: toDateTime(item.start_date ?? null),
            endDate: toDateTime(item.end_date ?? null),
            quantityPrescribed: Math.max(1, Number(item.quantity_prescribed ?? 1)),
            route: item.route ?? null,
            isPasserBy: parsePasserBy(item.is_passer_by),
            instructions: item.instructions ?? null,
          },
          { client: trx }
        )
      }

      prescription.status = 'active'
      prescription.prescribedAt = DateTime.now()
      await prescription.save()

      return prescription
    })
  }
}
