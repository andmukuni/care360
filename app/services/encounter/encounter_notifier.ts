import type Encounter from '#models/encounter'
import Patient from '#models/patient'
import User from '#models/user'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { NotificationService } from '#services/encounter/notification_service'

const NOTIFICATION_TYPE = 'App\\Notifications\\EncounterStageNotification'

/**
 * Broadcasts encounter stage handoffs to staff via database notifications so
 * they appear in the global notifications panel.
 *
 * Ported from App\Services\Encounter\EncounterNotifier (+ the data payload from
 * App\Notifications\EncounterStageNotification::toDatabase).
 */
export class EncounterNotifier {
  constructor(private readonly notifications: NotificationService = new NotificationService()) {}

  /**
   * Notify all staff (except the actor, when known) that an encounter has moved
   * from one stage to another.
   */
  async notifyStageTransition(
    encounter: Encounter,
    fromStage: EncounterStage | null,
    toStage: EncounterStage,
    actorId: number | null = null
  ): Promise<void> {
    const actor = actorId ? await User.find(actorId) : null
    const recipients = await this.recipients(actorId)
    if (recipients.length === 0) {
      return
    }

    const data = this.buildData({
      encounterNumber: encounter.encounterNumber,
      encounterId: encounter.id,
      fromStageLabel: fromStage ? EncounterStageHelper.label(fromStage) : null,
      toStageLabel: EncounterStageHelper.label(toStage),
      actorName: actor?.name ?? null,
      patientName: await this.resolvePatientName(encounter),
      type: 'info',
    })

    await this.notifications.createMany(recipients, NOTIFICATION_TYPE, data)
  }

  /** Notify all staff (except the actor) that the encounter has been closed. */
  async notifyClosure(encounter: Encounter, actorId: number | null = null): Promise<void> {
    const actor = actorId ? await User.find(actorId) : null
    const recipients = await this.recipients(actorId)
    if (recipients.length === 0) {
      return
    }

    const data = this.buildData({
      encounterNumber: encounter.encounterNumber,
      encounterId: encounter.id,
      fromStageLabel: EncounterStageHelper.label(EncounterStage.Pharmacy),
      toStageLabel: 'Closed',
      actorName: actor?.name ?? null,
      patientName: await this.resolvePatientName(encounter),
      type: 'success',
    })

    await this.notifications.createMany(recipients, NOTIFICATION_TYPE, data)
  }

  private async resolvePatientName(encounter: Encounter): Promise<string | null> {
    if (encounter.patient) {
      return encounter.patient.fullName ?? null
    }
    if (!encounter.patientId) {
      return null
    }
    const patient = await Patient.find(encounter.patientId)
    return patient?.fullName ?? null
  }

  private async recipients(actorId: number | null): Promise<number[]> {
    const query = User.query().select('id')
    if (actorId) {
      query.whereNot('id', actorId)
    }
    const users = await query
    return users.map((u) => u.id)
  }

  private buildData(input: {
    encounterNumber: string
    encounterId: number
    fromStageLabel: string | null
    toStageLabel: string
    actorName: string | null
    patientName: string | null
    type: string
  }): Record<string, unknown> {
    const patient = input.patientName ? ` for ${input.patientName}` : ''
    const by = input.actorName ? ` by ${input.actorName}` : ''

    let title: string
    let message: string

    if (input.toStageLabel === 'Closed') {
      title = `Encounter ${input.encounterNumber} closed`
      message = `Encounter${patient} has been closed and locked${by}.`
    } else {
      title = `Encounter ${input.encounterNumber} queued to ${input.toStageLabel}`
      message = `Encounter${patient} moved to ${input.toStageLabel}${by}.`
    }

    return {
      title,
      message,
      type: input.type,
      link: `/encounters/${input.encounterId}`,
      encounter: {
        id: input.encounterId,
        number: input.encounterNumber,
      },
      from_stage: input.fromStageLabel,
      to_stage: input.toStageLabel,
    }
  }
}
