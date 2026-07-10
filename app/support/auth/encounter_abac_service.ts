import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import type Encounter from '#models/encounter'

/**
 * Attribute-based access rules for encounters. Ported from
 * App\Support\Auth\EncounterAbacService.
 *
 * These checks are purely about the *state* of an encounter (locked, current
 * stage, current status, soft-deleted) — role/permission checks live in the
 * EncounterPolicy.
 */
export default class EncounterAbacService {
  canWriteEncounter(encounter: Encounter): boolean {
    return !encounter.isLocked
  }

  canOperateOnEncounterStage(encounter: Encounter, expectedStage: EncounterStage): boolean {
    return encounter.currentStage === expectedStage
  }

  canReceiveFromQueue(
    encounter: Encounter,
    expectedStage: EncounterStage,
    expectedStatus: EncounterStatus = EncounterStatus.Queued
  ): boolean {
    return (
      this.canWriteEncounter(encounter) &&
      this.canOperateOnEncounterStage(encounter, expectedStage) &&
      encounter.currentStatus === expectedStatus
    )
  }

  canEditInProgress(
    encounter: Encounter,
    expectedStage: EncounterStage,
    expectedStatus: EncounterStatus = EncounterStatus.InProgress
  ): boolean {
    return (
      this.canWriteEncounter(encounter) &&
      this.canOperateOnEncounterStage(encounter, expectedStage) &&
      encounter.currentStatus === expectedStatus
    )
  }

  canAdvanceToNextStage(encounter: Encounter, expectedStage: EncounterStage): boolean {
    return (
      this.canWriteEncounter(encounter) &&
      this.canOperateOnEncounterStage(encounter, expectedStage) &&
      [EncounterStatus.Queued, EncounterStatus.InProgress].includes(encounter.currentStatus)
    )
  }

  canViewEncounter(encounter: Encounter): boolean {
    return !encounter.trashed
  }
}
