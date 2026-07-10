/**
 * Encounter statuses. Ported from App\Enums\EncounterStatus.
 */
export enum EncounterStatus {
  Started = 'started',
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

const LABELS: Record<EncounterStatus, string> = {
  [EncounterStatus.Started]: 'Started',
  [EncounterStatus.Queued]: 'Queued',
  [EncounterStatus.InProgress]: 'In Progress',
  [EncounterStatus.Completed]: 'Completed',
  [EncounterStatus.Cancelled]: 'Cancelled',
}

export const EncounterStatusHelper = {
  label: (status: EncounterStatus) => LABELS[status],
  isActive: (status: EncounterStatus) =>
    [EncounterStatus.Started, EncounterStatus.Queued, EncounterStatus.InProgress].includes(status),
  isClosed: (status: EncounterStatus) =>
    [EncounterStatus.Completed, EncounterStatus.Cancelled].includes(status),
}
