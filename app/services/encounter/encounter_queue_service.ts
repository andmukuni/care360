import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Encounter from '#models/encounter'
import EncounterQueueTransition from '#models/encounter_queue_transition'
import { EncounterStage } from '#enums/encounter_stage'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { staffQueueBroadcast } from '#services/staff/staff_queue_broadcast_service'

/**
 * Records queue transitions between departments.
 * Ported from App\Services\Encounter\EncounterQueueService.
 */
export class EncounterQueueService {
  /**
   * Places the encounter in the queue for the given target stage.
   */
  async queueTo(
    encounter: Encounter,
    toStage: EncounterStage,
    queuedBy: number,
    notes: string | null = null,
    client?: TransactionClientContract
  ): Promise<EncounterQueueTransition> {
    const transition = await EncounterQueueTransition.create(
      {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        fromStage: encounter.currentStage,
        toStage,
        queuedBy,
        queuedAt: DateTime.now(),
        status: QueueTransitionStatus.Queued,
        transitionNotes: notes,
      },
      { client }
    )

    staffQueueBroadcast.notifyStages([encounter.currentStage, toStage], client)

    return transition
  }

  /** Marks a pending queue transition as received by the accepting department. */
  async receive(
    transition: EncounterQueueTransition,
    receivedBy: number,
    client?: TransactionClientContract
  ): Promise<EncounterQueueTransition> {
    if (client) transition.useTransaction(client)
    transition.receivedBy = receivedBy
    transition.receivedAt = DateTime.now()
    transition.status = QueueTransitionStatus.Received
    await transition.save()

    staffQueueBroadcast.notifyStages([transition.toStage as EncounterStage], client)

    return transition
  }

  /** Marks a queue transition as completed (stage work is done). */
  async complete(
    transition: EncounterQueueTransition,
    client?: TransactionClientContract
  ): Promise<EncounterQueueTransition> {
    if (client) transition.useTransaction(client)
    transition.status = QueueTransitionStatus.Completed
    await transition.save()

    staffQueueBroadcast.notifyStages([transition.toStage as EncounterStage], client)

    return transition
  }

  /**
   * Retrieves the currently open (queued or received) transition for the
   * encounter's current stage, or null if none exists.
   */
  getOpenTransition(
    encounter: Encounter,
    client?: TransactionClientContract
  ): Promise<EncounterQueueTransition | null> {
    return EncounterQueueTransition.query({ client })
      .where('encounter_id', encounter.id)
      .where('to_stage', encounter.currentStage)
      .whereIn('status', [QueueTransitionStatus.Queued, QueueTransitionStatus.Received])
      .orderBy('id', 'desc')
      .first()
  }

  /** Returns all transitions for an encounter, ordered chronologically. */
  getTimeline(
    encounter: Encounter,
    client?: TransactionClientContract
  ): Promise<EncounterQueueTransition[]> {
    return EncounterQueueTransition.query({ client })
      .where('encounter_id', encounter.id)
      .orderBy('queued_at', 'asc')
  }
}
