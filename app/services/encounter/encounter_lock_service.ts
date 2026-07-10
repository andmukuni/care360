import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Encounter from '#models/encounter'
import { EncounterLockedException } from '#mixins/locks_encounter_records'

/**
 * Lock assertions and mutation. Ported from
 * App\Services\Encounter\EncounterLockService.
 *
 * Throws the same EncounterLockedException as the LocksEncounterRecords mixin so
 * stage-record guards and the service stay aligned.
 */
export class EncounterLockService {
  isLocked(encounter: Encounter): boolean {
    return encounter.isLocked
  }

  /**
   * Throws EncounterLockedException if the encounter is locked.
   * Call this at the start of every write operation.
   */
  assertNotLocked(encounter: Encounter): void {
    if (encounter.isLocked) {
      throw new EncounterLockedException(
        `Encounter [${encounter.encounterNumber}] is locked and cannot be modified.`
      )
    }
  }

  /**
   * Locks the encounter permanently. Should only be called when closing.
   */
  async lock(encounter: Encounter, client?: TransactionClientContract): Promise<Encounter> {
    if (client) encounter.useTransaction(client)
    encounter.isLocked = true
    await encounter.save()

    return encounter
  }

  /** Unlocks a previously locked encounter (e.g. after reopen). */
  async unlock(encounter: Encounter, client?: TransactionClientContract): Promise<Encounter> {
    if (client) encounter.useTransaction(client)
    encounter.isLocked = false
    await encounter.save()

    return encounter
  }
}
