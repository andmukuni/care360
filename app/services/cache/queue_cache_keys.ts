import type { EncounterStage } from '#enums/encounter_stage'

export const QUEUE_TAGS = {
  all: 'queues',
} as const

export function queueStageTag(stage: EncounterStage | string): string {
  return `queue:${stage}`
}

export function stageQueuePageKey(parts: {
  stage: string
  scope?: string
  queuedPage: number
  progressPage: number
  partiallyDispensedPage?: number
  orderBy?: string
}): string {
  const scope = parts.scope ? `:${parts.scope}` : ''
  const partial =
    parts.partiallyDispensedPage !== undefined ? `:pd${parts.partiallyDispensedPage}` : ''
  const order = parts.orderBy ? `:${parts.orderBy}` : ''
  return `queue:${parts.stage}${scope}${order}:q${parts.queuedPage}:p${parts.progressPage}${partial}`
}

export function closedQueuePageKey(stage: string, closedPage: number, closedSearch: string): string {
  const search = closedSearch.trim() === '' ? 'all' : encodeURIComponent(closedSearch.trim().toLowerCase())
  return `queue:${stage}:closed:${search}:c${closedPage}`
}

export function apiStageQueueKey(stage: string): string {
  return `queue:api:${stage}`
}

export function registrationDeskPageKey(page: number): string {
  return `queue:registration:desk:p${page}`
}
