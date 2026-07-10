import { Exception } from '@adonisjs/core/exceptions'
import type { EncounterStage } from '#enums/encounter_stage'

/**
 * Encounter-domain exceptions. Ported from App\Exceptions\Encounter\*.
 *
 * Note: EncounterLockedException lives in #mixins/locks_encounter_records and is
 * re-exported from there so the lock service and the record mixin throw the same
 * type. See EncounterLockService.
 */

/**
 * Thrown when a from→to stage transition is not permitted by the stage graph.
 */
export class InvalidEncounterTransitionException extends Exception {
  static status = 422
  static code = 'E_INVALID_ENCOUNTER_TRANSITION'

  constructor(from: EncounterStage, to: EncounterStage) {
    super(
      `Cannot transition encounter from [${from}] to [${to}]. Invalid stage transition.`
    )
  }
}

/**
 * Thrown when an encounter is not at the stage an action requires.
 */
export class InvalidEncounterStageException extends Exception {
  static status = 422
  static code = 'E_INVALID_ENCOUNTER_STAGE'

  constructor(expected: EncounterStage, actual: EncounterStage) {
    super(`Expected encounter to be at stage [${expected}] but it is at [${actual}].`)
  }
}

/**
 * Thrown when a patient already has an active (open, unlocked) encounter.
 */
export class ActiveEncounterExistsException extends Exception {
  static status = 409
  static code = 'E_ACTIVE_ENCOUNTER_EXISTS'

  constructor(encounterNumber: string) {
    super(
      `Patient already has an active encounter [${encounterNumber}] that must be closed before a new one can be started.`
    )
  }
}

/**
 * Thrown when a patient is not eligible to start a new encounter.
 */
export class PatientNotEligibleForEncounterException extends Exception {
  static status = 422
  static code = 'E_PATIENT_NOT_ELIGIBLE'

  static readonly REASON_DECEASED = 'deceased'
  static readonly REASON_INACTIVE = 'inactive'

  readonly reason: string

  constructor(patientName: string, reason: string) {
    let message: string
    switch (reason) {
      case PatientNotEligibleForEncounterException.REASON_DECEASED:
        message = `Patient ${patientName} is marked as deceased and cannot start a new encounter.`
        break
      case PatientNotEligibleForEncounterException.REASON_INACTIVE:
        message = `Patient ${patientName} is inactive. Confirm before starting an encounter.`
        break
      default:
        message = `Patient ${patientName} is not eligible for a new encounter.`
    }
    super(message)
    this.reason = reason
  }
}
