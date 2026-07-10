import Encounter from '#models/encounter'
import Patient from '#models/patient'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus, EncounterStatusHelper } from '#enums/encounter_status'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientVisitGuidance from '#services/portal/patient_visit_guidance'

/**
 * Live visit / queue status for the patient portal home screen.
 *
 * Ported from App\Services\Portal\PatientVisitStatusService.
 */
export default class PatientVisitStatusService {
  constructor(
    private readonly medicalSummary: PatientMedicalSummaryService = new PatientMedicalSummaryService(),
    private readonly guidance: PatientVisitGuidance = new PatientVisitGuidance()
  ) {}

  /**
   * JSON-safe visit status (no Lucid models).
   */
  async publicPayload(patient: Patient): Promise<Record<string, unknown>> {
    return this.normalizePayload(await this.statusPayload(patient))
  }

  async statusPayload(patient: Patient): Promise<Record<string, unknown>> {
    const encounter = await this.medicalSummary.activeEncounter(patient)

    if (!encounter) {
      return {
        has_active_visit: false,
        encounter: null,
        stage: null,
        status: null,
        stage_label: null,
        status_label: null,
        queue_position: null,
        guidance: null,
        poll_interval_seconds: PatientVisitGuidance.IDLE_POLL_INTERVAL_SECONDS,
      }
    }

    const stage = String(encounter.currentStage ?? '')
    const status = String(encounter.currentStatus ?? '')
    const queuePosition = await this.queuePosition(encounter)

    const stageEnum = this.tryStage(stage)
    const statusEnum = this.tryStatus(status)

    return {
      has_active_visit: true,
      encounter,
      stage,
      status,
      stage_label: stageEnum ? EncounterStageHelper.label(stageEnum) : this.humanize(stage),
      status_label: statusEnum ? EncounterStatusHelper.label(statusEnum) : this.humanize(status),
      queue_position: queuePosition,
      guidance: this.guidance.forStageAndStatus(stage, status, queuePosition),
      poll_interval_seconds: PatientVisitGuidance.POLL_INTERVAL_SECONDS,
    }
  }

  private async queuePosition(encounter: Encounter): Promise<number | null> {
    const stage = String(encounter.currentStage ?? '')

    if (!stage || String(encounter.currentStatus ?? '') !== 'queued') {
      return null
    }

    const result = await Encounter.query()
      .where('currentStage', stage)
      .where('currentStatus', 'queued')
      .where('startedAt', '<=', encounter.startedAt.toSQL()!)
      .whereNot('id', encounter.id)
      .count('* as total')

    const ahead = Number(result[0].$extras.total)

    return ahead + 1
  }

  private normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const encounter = payload.encounter

    return {
      has_active_visit: payload.has_active_visit,
      stage: payload.stage,
      status: payload.status,
      stage_label: payload.stage_label,
      status_label: payload.status_label,
      queue_position: payload.queue_position,
      guidance: payload.guidance,
      poll_interval_seconds: payload.poll_interval_seconds,
      encounter:
        encounter instanceof Encounter
          ? {
              id: encounter.id,
              encounter_number: encounter.encounterNumber,
              started_at: encounter.startedAt ? encounter.startedAt.toISO() : null,
            }
          : null,
    }
  }

  private humanize(value: string): string {
    const replaced = value.replace(/_/g, ' ')
    return replaced.charAt(0).toUpperCase() + replaced.slice(1)
  }

  private tryStage(value: string): EncounterStage | null {
    const match = Object.values(EncounterStage).find((s) => s === value)
    return (match as EncounterStage) ?? null
  }

  private tryStatus(value: string): EncounterStatus | null {
    const match = Object.values(EncounterStatus).find((s) => s === value)
    return (match as EncounterStatus) ?? null
  }
}
