import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'

export type PublicStatsPayload = {
  ok: true
  generated_at: string
  timezone: string
  facility_name: string
  encounters: {
    total: number
    today: number
    active: number
    completed: number
    cancelled: number
  }
  patients: {
    total: number
    male: number
    female: number
    unspecified: number
    attended_today: number
  }
  live: Record<string, number>
}

const MALE_VALUES = new Set(['male', 'm'])
const FEMALE_VALUES = new Set(['female', 'f'])

export function classifyPatientGender(gender: string | null | undefined): 'male' | 'female' | 'unspecified' {
  const normalized = String(gender ?? '')
    .trim()
    .toLowerCase()

  if (MALE_VALUES.has(normalized)) return 'male'
  if (FEMALE_VALUES.has(normalized)) return 'female'
  return 'unspecified'
}

export function emptyLiveQueueCounts(): Record<string, number> {
  const live: Record<string, number> = {}
  for (const stage of EncounterStageHelper.activeStages()) {
    live[stage] = 0
  }
  return live
}

export function applyLiveStageCounts(
  rows: Array<{ current_stage?: string; total?: number | string }>
): Record<string, number> {
  const live = emptyLiveQueueCounts()
  for (const row of rows) {
    const stage = String(row.current_stage ?? '')
    if (stage && stage !== EncounterStage.Completed && stage in live) {
      live[stage] = Number(row.total ?? 0)
    }
  }
  return live
}

export const PUBLIC_STATS_CACHE_KEY = 'public:stats:live'
export const PUBLIC_STATS_CACHE_TTL = '30s'
