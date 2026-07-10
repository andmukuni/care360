import { EncounterStage } from '#enums/encounter_stage'
import { InvalidEncounterTransitionException } from '#support/encounter/exceptions'

/**
 * Defines the legal stage transition graph for the encounter pipeline.
 * Ported from App\Support\Encounter\EncounterStageMap.
 *
 * Standard path:     Registration → Triage → Screening → Lab → ScreeningReview → Pharmacy → Completed
 * Short-circuit path: Registration → Triage → Screening → Pharmacy → Completed  (no lab)
 * Treatment branch:  Pharmacy → TreatmentRoom → Completed
 *                     Screening → TreatmentRoom → Completed  (direct, no pharmacy)
 */
export class EncounterStageMap {
  /**
   * Returns all stages that may legally follow the given stage.
   */
  static validNextStages(stage: EncounterStage): EncounterStage[] {
    switch (stage) {
      case EncounterStage.Registration:
        return [EncounterStage.Triage]
      case EncounterStage.Triage:
        return [EncounterStage.Screening]
      case EncounterStage.Screening:
        return [
          EncounterStage.Lab,
          EncounterStage.Pharmacy,
          EncounterStage.TreatmentRoom,
          EncounterStage.Triage,
        ]
      case EncounterStage.Lab:
        return [EncounterStage.ScreeningReview]
      case EncounterStage.ScreeningReview:
        return [EncounterStage.Pharmacy]
      case EncounterStage.Pharmacy:
        return [EncounterStage.Completed, EncounterStage.Screening, EncounterStage.TreatmentRoom]
      case EncounterStage.TreatmentRoom:
        return [EncounterStage.Completed]
      case EncounterStage.Completed:
        return []
    }
  }

  /**
   * Returns true if the from→to transition is legal.
   */
  static canTransitionTo(from: EncounterStage, to: EncounterStage): boolean {
    return this.validNextStages(from).includes(to)
  }

  /**
   * Throws InvalidEncounterTransitionException if the transition is not allowed.
   */
  static assertCanTransitionTo(from: EncounterStage, to: EncounterStage): void {
    if (!this.canTransitionTo(from, to)) {
      throw new InvalidEncounterTransitionException(from, to)
    }
  }

  /**
   * Returns all stages that may legally precede the given stage.
   */
  static validPriorStages(stage: EncounterStage): EncounterStage[] {
    switch (stage) {
      case EncounterStage.Registration:
        return []
      case EncounterStage.Triage:
        return [EncounterStage.Registration]
      case EncounterStage.Screening:
        return [EncounterStage.Triage, EncounterStage.Pharmacy]
      case EncounterStage.Lab:
        return [EncounterStage.Screening]
      case EncounterStage.ScreeningReview:
        return [EncounterStage.Lab]
      case EncounterStage.Pharmacy:
        return [EncounterStage.Screening, EncounterStage.ScreeningReview]
      case EncounterStage.TreatmentRoom:
        return [EncounterStage.Pharmacy, EncounterStage.Screening]
      case EncounterStage.Completed:
        return [EncounterStage.Pharmacy, EncounterStage.TreatmentRoom]
    }
  }
}
