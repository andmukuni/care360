import type Encounter from '#models/encounter'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import type {
  AppNotification,
  Notifiable,
  NotificationChannel,
} from '#services/notifications/notification_service'

/**
 * Database notification fired whenever an encounter is queued to a new stage
 * (or closed). Ported from App\Notifications\EncounterStageNotification.
 */
export class EncounterStageNotification implements AppNotification {
  readonly type = 'App\\Notifications\\EncounterStageNotification'

  constructor(
    private readonly encounterNumber: string,
    private readonly encounterId: number,
    private readonly fromStage: string | null,
    private readonly toStage: string,
    private readonly actorName: string | null,
    private readonly patientName: string | null = null,
    private readonly kind: string = 'info'
  ) {}

  static forQueueTransition(
    encounter: Encounter,
    fromStage: EncounterStage | null,
    toStage: EncounterStage,
    actorName: string | null
  ): EncounterStageNotification {
    return new EncounterStageNotification(
      encounter.encounterNumber,
      encounter.id,
      fromStage ? EncounterStageHelper.label(fromStage) : null,
      EncounterStageHelper.label(toStage),
      actorName,
      encounter.patient?.fullName ?? null,
      'info'
    )
  }

  static forClosure(encounter: Encounter, actorName: string | null): EncounterStageNotification {
    return new EncounterStageNotification(
      encounter.encounterNumber,
      encounter.id,
      'Pharmacy',
      'Closed',
      actorName,
      encounter.patient?.fullName ?? null,
      'success'
    )
  }

  via(_notifiable: Notifiable): NotificationChannel[] {
    return ['database']
  }

  toDatabase(_notifiable: Notifiable): Record<string, unknown> {
    const patient = this.patientName ? ` for ${this.patientName}` : ''
    const by = this.actorName ? ` by ${this.actorName}` : ''

    let title: string
    let message: string
    if (this.toStage === 'Closed') {
      title = `Encounter ${this.encounterNumber} closed`
      message = `Encounter${patient} has been closed and locked${by}.`
    } else {
      title = `Encounter ${this.encounterNumber} queued to ${this.toStage}`
      message = `Encounter${patient} moved to ${this.toStage}${by}.`
    }

    return {
      title,
      message,
      type: this.kind,
      link: `/encounters/${this.encounterId}`,
      encounter: {
        id: this.encounterId,
        number: this.encounterNumber,
      },
      from_stage: this.fromStage,
      to_stage: this.toStage,
    }
  }
}
