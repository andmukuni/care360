import { DateTime } from 'luxon'
import type Encounter from '#models/encounter'
import { EncounterStage } from '#enums/encounter_stage'

/** Maximum encounter duration (start → close) allowed for same-day reopen. */
export const REOPEN_MAX_ENCOUNTER_HOURS = 12

/** Start of the current calendar day in the app timezone. */
export function closedEncounterDayStart(): DateTime {
  return DateTime.now().startOf('day')
}

export function encounterDurationHours(encounter: Encounter): number {
  const end = encounter.closedAt ?? DateTime.now()
  return end.diff(encounter.startedAt, 'hours').hours
}

export function reopenEligibility(encounter: Encounter): { allowed: boolean; reason: string | null } {
  if (!encounter.isLocked || encounter.currentStage !== EncounterStage.Completed) {
    return { allowed: false, reason: null }
  }

  if (!encounter.closedAt || encounter.closedAt < closedEncounterDayStart()) {
    return { allowed: false, reason: 'Only encounters closed today can be reopened.' }
  }

  if (encounterDurationHours(encounter) > REOPEN_MAX_ENCOUNTER_HOURS) {
    return {
      allowed: false,
      reason: `Encounters open longer than ${REOPEN_MAX_ENCOUNTER_HOURS} hours cannot be reopened.`,
    }
  }

  return { allowed: true, reason: null }
}

export function assertCanReopenEncounter(encounter: Encounter): void {
  const { allowed, reason } = reopenEligibility(encounter)
  if (!allowed) {
    throw new Error(reason ?? 'This encounter cannot be reopened.')
  }
}
