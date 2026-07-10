/**
 * Encounter pipeline stages. Ported from App\Enums\EncounterStage.
 */
export enum EncounterStage {
  Registration = 'registration',
  Triage = 'triage',
  Screening = 'screening',
  Lab = 'lab',
  ScreeningReview = 'screening_review',
  Pharmacy = 'pharmacy',
  TreatmentRoom = 'treatment_room',
  Completed = 'completed',
}

const LABELS: Record<EncounterStage, string> = {
  [EncounterStage.Registration]: 'Registration',
  [EncounterStage.Triage]: 'Triage',
  [EncounterStage.Screening]: 'Screening',
  [EncounterStage.Lab]: 'Lab',
  [EncounterStage.ScreeningReview]: 'Screening Review',
  [EncounterStage.Pharmacy]: 'Pharmacy',
  [EncounterStage.TreatmentRoom]: 'Treatment Room',
  [EncounterStage.Completed]: 'Completed',
}

const SEQUENCE: Record<EncounterStage, number> = {
  [EncounterStage.Registration]: 1,
  [EncounterStage.Triage]: 2,
  [EncounterStage.Screening]: 3,
  [EncounterStage.Lab]: 4,
  [EncounterStage.ScreeningReview]: 5,
  [EncounterStage.Pharmacy]: 6,
  [EncounterStage.TreatmentRoom]: 7,
  [EncounterStage.Completed]: 8,
}

export const EncounterStageHelper = {
  label: (stage: EncounterStage) => LABELS[stage],
  sequence: (stage: EncounterStage) => SEQUENCE[stage],
  isTerminal: (stage: EncounterStage) => stage === EncounterStage.Completed,
  activeStages: (): EncounterStage[] => [
    EncounterStage.Registration,
    EncounterStage.Triage,
    EncounterStage.Screening,
    EncounterStage.Lab,
    EncounterStage.ScreeningReview,
    EncounterStage.Pharmacy,
    EncounterStage.TreatmentRoom,
  ],
}
