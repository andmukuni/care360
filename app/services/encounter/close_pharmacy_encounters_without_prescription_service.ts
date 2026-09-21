import logger from '@adonisjs/core/services/logger'
import Encounter from '#models/encounter'
import User from '#models/user'
import ClosePharmacyEncounterWithoutPrescriptionAction from '#actions/encounter/close_pharmacy_encounter_without_prescription_action'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import {
  PHARMACY_NO_PRESCRIPTION_CLOSURE_NOTE,
  pharmacyEncountersWithoutPrescriptionQuery,
} from '#support/encounter/stage_prerequisites'

export type ClosedPharmacyWithoutPrescription = {
  id: number
  encounterNumber: string
}

/**
 * Finds open Pharmacy encounters with no prescription items and closes them.
 */
export default class ClosePharmacyEncountersWithoutPrescriptionService {
  private readonly queueService = new EncounterQueueService()
  private readonly closer = new ClosePharmacyEncounterWithoutPrescriptionAction()

  async handle(options: { dryRun?: boolean } = {}): Promise<ClosedPharmacyWithoutPrescription[]> {
    const encounters = await pharmacyEncountersWithoutPrescriptionQuery().orderBy('id', 'asc')
    const closed: ClosedPharmacyWithoutPrescription[] = []

    for (const encounter of encounters) {
      const summary = {
        id: encounter.id,
        encounterNumber: encounter.encounterNumber,
      }

      if (options.dryRun) {
        closed.push(summary)
        continue
      }

      try {
        const actorId = await this.resolveActorId(encounter)
        await this.closer.handle(encounter, actorId, PHARMACY_NO_PRESCRIPTION_CLOSURE_NOTE)
        closed.push(summary)
      } catch (error) {
        logger.warn(
          { err: error, encounterId: encounter.id, encounterNumber: encounter.encounterNumber },
          'Failed to auto-close Pharmacy encounter without prescription'
        )
      }
    }

    return closed
  }

  private async resolveActorId(encounter: Encounter): Promise<number> {
    const transition = await this.queueService.getOpenTransition(encounter)
    if (transition?.queuedBy) {
      return transition.queuedBy
    }

    if (encounter.startedBy) {
      return encounter.startedBy
    }

    const fallback = await User.query().orderBy('id', 'asc').first()
    if (!fallback) {
      throw new Error('No user available to record automatic pharmacy closure.')
    }

    return fallback.id
  }
}
