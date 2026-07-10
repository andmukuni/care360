import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Encounter from '#models/encounter'
import type ScreeningRecord from '#models/screening_record'
import PharmacyPrescription from '#models/pharmacy_prescription'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import PharmacyRecommendation from '#models/pharmacy_recommendation'
import type { RecommendationNotificationEngineContract } from '#services/encounter/external_contracts'
import { FormulationNormalizer } from '#support/encounter/formulation_normalizer'
import { toDateTime } from '#support/encounter/coerce'
import { parsePasserBy } from '#support/encounter/prescription_item_payload'
import { getLatestPrescription, getPrescriptionForScreeningRecord } from '#services/encounter/encounter_records'

/**
 * Creates a PharmacyPrescription with its items for an encounter, optionally
 * linked to a ScreeningRecord and recording medication recommendations.
 * Ported from App\Actions\Encounter\CreatePrescriptionAction.
 *
 * `notificationEngine` is a cross-phase (Notifications) dependency; when not
 * injected, the post-commit recommendation notifications are skipped.
 */
export default class CreatePrescriptionAction {
  constructor(
    private readonly notificationEngine?: RecommendationNotificationEngineContract
  ) {}

  async handle(
    encounter: Encounter,
    data: Record<string, any>,
    prescribedById: number,
    screeningRecord: ScreeningRecord | null = null
  ): Promise<PharmacyPrescription> {
    const createdRecommendations: PharmacyRecommendation[] = []

    const prescription = await db.transaction(async (trx) => {
      const items: any[] = data.items ?? []

      const sourceItemIds = [
        ...new Set(
          items
            .map((i) => i.source_prescription_item_id)
            .filter((id) => !!id)
            .map((id) => Number(id))
        ),
      ]

      const sourceItemsById = new Map<number, PharmacyPrescriptionItem>()
      if (sourceItemIds.length > 0) {
        const sourceItems = await PharmacyPrescriptionItem.query({ client: trx })
          .whereIn('id', sourceItemIds)
          .preload('pharmacyPrescription')
        for (const sourceItem of sourceItems) {
          sourceItemsById.set(sourceItem.id, sourceItem)
        }
      }

      let prescription: PharmacyPrescription

      if (screeningRecord) {
        const existing = await getPrescriptionForScreeningRecord(
          encounter.id,
          screeningRecord.id,
          trx
        )

        if (existing) {
          existing.useTransaction(trx)
          existing.prescribedBy = prescribedById
          existing.notes = data.notes ?? existing.notes
          existing.prescribedAt = DateTime.now()
          await existing.save()
          await PharmacyPrescriptionItem.query({ client: trx })
            .where('pharmacy_prescription_id', existing.id)
            .delete()
          prescription = existing
        } else {
          prescription = await PharmacyPrescription.create(
            {
              encounterId: encounter.id,
              patientId: encounter.patientId,
              screeningRecordId: screeningRecord.id,
              prescribedBy: prescribedById,
              prescriptionNumber: await this.generatePrescriptionNumber(trx),
              status: 'active',
              notes: data.notes ?? null,
              prescribedAt: DateTime.now(),
            },
            { client: trx }
          )
        }
      } else {
        const existing = await getLatestPrescription(encounter.id, trx)

        if (existing) {
          existing.useTransaction(trx)
          existing.prescribedBy = prescribedById
          if (data.notes !== undefined) {
            existing.notes = data.notes ?? existing.notes
          }
          existing.prescribedAt = DateTime.now()
          existing.status = 'active'
          await existing.save()
          prescription = existing
        } else {
          prescription = await PharmacyPrescription.create(
            {
              encounterId: encounter.id,
              patientId: encounter.patientId,
              screeningRecordId: null,
              prescribedBy: prescribedById,
              prescriptionNumber: await this.generatePrescriptionNumber(trx),
              status: 'active',
              notes: data.notes ?? null,
              prescribedAt: DateTime.now(),
            },
            { client: trx }
          )
        }
      }

      for (const item of items) {
        const createdItem = await PharmacyPrescriptionItem.create(
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

        const sourceItemId =
          item.source_prescription_item_id !== undefined &&
          item.source_prescription_item_id !== null
            ? Number(item.source_prescription_item_id)
            : null

        if (sourceItemId) {
          const sourceItem = sourceItemsById.get(sourceItemId)
          const belongsToEncounter =
            !!sourceItem &&
            Number(sourceItem.pharmacyPrescription?.encounterId) === Number(encounter.id)

          if (belongsToEncounter && sourceItem) {
            const recommendation = await PharmacyRecommendation.create(
              {
                encounterId: encounter.id,
                sourcePrescriptionId: sourceItem.pharmacyPrescriptionId,
                sourcePrescriptionItemId: sourceItemId,
                recommendedPrescriptionId: prescription.id,
                recommendedPrescriptionItemId: createdItem.id,
                recommendedBy: prescribedById,
                status: 'accepted',
                recommendationNote: item.recommendation_note ?? null,
              },
              { client: trx }
            )

            createdRecommendations.push(recommendation)
          }
        }
      }

      // Mark screening record as prescribed
      if (screeningRecord) {
        screeningRecord.useTransaction(trx)
        screeningRecord.prescribed = true
        await screeningRecord.save()
      }

      return prescription
    })

    // After commit: fire recommendation notifications (cross-phase engine).
    if (createdRecommendations.length > 0 && this.notificationEngine) {
      for (const recommendation of createdRecommendations) {
        await this.notificationEngine.notifyMedicationRecommendation({
          encounter,
          recommendation,
          actorId: prescribedById,
        })
      }
    }

    return prescription
  }

  private async generatePrescriptionNumber(client: TransactionClientContract): Promise<string> {
    const date = DateTime.now().toFormat('yyyyLLdd')

    // Note: the Laravel version wraps the count in lockForUpdate(); FOR UPDATE
    // is not valid alongside an aggregate on PostgreSQL, so it is omitted here.
    const result = await PharmacyPrescription.query({ client })
      .where('prescription_number', 'like', `RX-${date}-%`)
      .count('* as total')

    const count = Number(result[0].$extras.total)

    return `RX-${date}-${String(count + 1).padStart(4, '0')}`
  }
}
