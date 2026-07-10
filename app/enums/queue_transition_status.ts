/**
 * Queue transition statuses. Ported from App\Enums\QueueTransitionStatus.
 */
export enum QueueTransitionStatus {
  Queued = 'queued',
  Received = 'received',
  Completed = 'completed',
}

const LABELS: Record<QueueTransitionStatus, string> = {
  [QueueTransitionStatus.Queued]: 'Queued',
  [QueueTransitionStatus.Received]: 'Received',
  [QueueTransitionStatus.Completed]: 'Completed',
}

export const QueueTransitionStatusHelper = {
  label: (status: QueueTransitionStatus) => LABELS[status],
  isOpen: (status: QueueTransitionStatus) =>
    [QueueTransitionStatus.Queued, QueueTransitionStatus.Received].includes(status),
}
