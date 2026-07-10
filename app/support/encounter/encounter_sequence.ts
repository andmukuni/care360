import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'

/**
 * Ordering utilities for encounter stages. Ported from
 * App\Support\Encounter\EncounterSequence. Complements EncounterStageMap
 * (legal transitions) with numeric position comparisons.
 */
export class EncounterSequence {
  static of(stage: EncounterStage): number {
    return EncounterStageHelper.sequence(stage)
  }

  static isBefore(stage: EncounterStage, reference: EncounterStage): boolean {
    return EncounterStageHelper.sequence(stage) < EncounterStageHelper.sequence(reference)
  }

  static isAfter(stage: EncounterStage, reference: EncounterStage): boolean {
    return EncounterStageHelper.sequence(stage) > EncounterStageHelper.sequence(reference)
  }

  static isAtOrBefore(stage: EncounterStage, reference: EncounterStage): boolean {
    return EncounterStageHelper.sequence(stage) <= EncounterStageHelper.sequence(reference)
  }

  static isAtOrAfter(stage: EncounterStage, reference: EncounterStage): boolean {
    return EncounterStageHelper.sequence(stage) >= EncounterStageHelper.sequence(reference)
  }

  /**
   * Returns all stages sorted by sequence position (ascending).
   */
  static allInOrder(): EncounterStage[] {
    return Object.values(EncounterStage).sort(
      (a, b) => EncounterStageHelper.sequence(a) - EncounterStageHelper.sequence(b)
    )
  }

  /**
   * Returns all stages up to and including the given stage.
   */
  static upTo(upTo: EncounterStage): EncounterStage[] {
    return this.allInOrder().filter(
      (s) => EncounterStageHelper.sequence(s) <= EncounterStageHelper.sequence(upTo)
    )
  }
}
