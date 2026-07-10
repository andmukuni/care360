import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Encounter from '#models/encounter'
import EncounterStageLog from '#models/encounter_stage_log'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { EncounterStageMap } from '#support/encounter/encounter_stage_map'
import {
  InvalidEncounterStageException,
} from '#support/encounter/exceptions'
import { toJsonOrNull } from '#support/encounter/coerce'

/**
 * Stage/status assertions, stage transitions, and stage-log lifecycle.
 * Ported from App\Services\Encounter\EncounterWorkflowService.
 */
export class EncounterWorkflowService {
  // ─── Stage Assertions ─────────────────────────────────────────────────────

  /** Throws if the encounter is not at the expected stage. */
  assertStageIs(encounter: Encounter, expected: EncounterStage): void {
    if (encounter.currentStage !== expected) {
      throw new InvalidEncounterStageException(expected, encounter.currentStage)
    }
  }

  /** Throws if the encounter does not have the expected status. */
  assertStatusIs(encounter: Encounter, expected: EncounterStatus): void {
    if (encounter.currentStatus !== expected) {
      throw new Error(
        `Expected encounter status [${expected}] but found [${encounter.currentStatus}].`
      )
    }
  }

  // ─── Stage Transitions ────────────────────────────────────────────────────

  /**
   * Moves the encounter to a new stage and sets its status (default queued).
   * Validates that the transition is allowed before writing.
   */
  async advanceToStage(
    encounter: Encounter,
    nextStage: EncounterStage,
    nextStatus: EncounterStatus = EncounterStatus.Queued,
    client?: TransactionClientContract
  ): Promise<Encounter> {
    EncounterStageMap.assertCanTransitionTo(encounter.currentStage, nextStage)

    if (client) encounter.useTransaction(client)
    encounter.currentStage = nextStage
    encounter.currentStatus = nextStatus
    await encounter.save()

    return encounter
  }

  // ─── Stage Log Management ─────────────────────────────────────────────────

  /**
   * Opens a new stage-log entry for the encounter's current stage.
   * Called when a department receives the patient.
   */
  async openStageLog(
    encounter: Encounter,
    startedBy: number,
    notes: string | null = null,
    metadata: Record<string, unknown> = {},
    client?: TransactionClientContract
  ): Promise<EncounterStageLog> {
    return EncounterStageLog.create(
      {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        stageName: encounter.currentStage,
        stageSequence: EncounterStageHelper.sequence(encounter.currentStage),
        status: QueueTransitionStatus.Received,
        startedBy,
        startedAt: DateTime.now(),
        notes,
        metadata: toJsonOrNull(metadata),
      },
      { client }
    )
  }

  /**
   * Completes the active stage log for the encounter's current stage.
   * Called when a department finishes its work.
   */
  async completeStageLog(
    encounter: Encounter,
    completedBy: number,
    notes: string | null = null,
    client?: TransactionClientContract
  ): Promise<EncounterStageLog> {
    const log = await EncounterStageLog.query({ client })
      .where('encounter_id', encounter.id)
      .where('stage_name', encounter.currentStage)
      .whereNull('completed_at')
      .orderBy('id', 'desc')
      .first()

    if (!log) {
      throw new Error(
        `No open stage log found for encounter [${encounter.encounterNumber}] at stage [${encounter.currentStage}].`
      )
    }

    if (client) log.useTransaction(client)
    log.status = QueueTransitionStatus.Completed
    log.completedBy = completedBy
    log.completedAt = DateTime.now()
    log.notes = notes ?? log.notes
    await log.save()

    return log
  }

  /** Updates notes on the active (incomplete) stage log for the encounter's current stage. */
  async updateOpenStageLogNotes(
    encounter: Encounter,
    notes: string | null,
    client?: TransactionClientContract
  ): Promise<void> {
    const log = await EncounterStageLog.query({ client })
      .where('encounter_id', encounter.id)
      .where('stage_name', encounter.currentStage)
      .whereNull('completed_at')
      .orderBy('id', 'desc')
      .first()

    if (!log) {
      return
    }

    if (client) log.useTransaction(client)
    log.notes = notes
    await log.save()
  }

  /** Marks the encounter itself as in-progress (called on stage receive). */
  async markInProgress(
    encounter: Encounter,
    client?: TransactionClientContract
  ): Promise<Encounter> {
    if (client) encounter.useTransaction(client)
    encounter.currentStatus = EncounterStatus.InProgress
    await encounter.save()

    return encounter
  }
}
