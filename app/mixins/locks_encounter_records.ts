import { beforeSave, beforeDelete } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import type { BaseModel } from '@adonisjs/lucid/orm'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Thrown when a stage record is mutated while its parent encounter is locked.
 * Mirrors the behaviour of App\Services\Encounter\EncounterLockService.
 */
export class EncounterLockedException extends Exception {
  static status = 423
  static code = 'E_ENCOUNTER_LOCKED'
  constructor(message = 'This encounter is locked and can no longer be modified.') {
    super(message)
  }
}

/**
 * Mixin that blocks updates/deletes on stage-specific records when their parent
 * encounter is locked. Ported from App\Traits\LocksEncounterRecords.
 *
 * The consuming model MUST expose an `encounterId` column so we can look up the
 * parent encounter's lock state.
 */
export function LocksEncounterRecords<Model extends NormalizeConstructor<typeof BaseModel>>(
  superclass: Model
) {
  class LockAware extends superclass {
    @beforeSave()
    static async guardOnSave(row: any) {
      // Only enforce on existing rows; new rows are created before locking.
      if (!row.$isPersisted) return
      await LockAware.assertParentUnlocked(row)
    }

    @beforeDelete()
    static async guardOnDelete(row: any) {
      await LockAware.assertParentUnlocked(row)
    }

    static async assertParentUnlocked(row: any) {
      const encounterId = row.encounterId
      if (!encounterId) return
      // Lazy import avoids a circular dependency with the Encounter model.
      const { default: Encounter } = await import('#models/encounter')
      const encounter = await Encounter.find(encounterId)
      if (encounter && encounter.isLocked) {
        throw new EncounterLockedException()
      }
    }
  }
  return LockAware
}
