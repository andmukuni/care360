import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Encounter from '#models/encounter'
import EncounterAudit from '#models/encounter_audit'
import type { EncounterStage } from '#enums/encounter_stage'
import { toJsonOrNull } from '#support/encounter/coerce'

export interface RecordAuditInput {
  encounter: Encounter
  actionName: string
  actionStage: EncounterStage
  actionBy: number
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  notes?: string | null
  client?: TransactionClientContract
}

/**
 * Writes EncounterAudit rows. Ported from
 * App\Services\Encounter\EncounterAuditService.
 */
export class EncounterAuditService {
  async record(input: RecordAuditInput): Promise<EncounterAudit> {
    const { encounter, actionName, actionStage, actionBy, oldValues, newValues, notes, client } =
      input

    return EncounterAudit.create(
      {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        actionName,
        actionStage,
        actionBy,
        oldValues: toJsonOrNull(oldValues ?? null),
        newValues: toJsonOrNull(newValues ?? null),
        notes: notes ?? null,
        actionAt: DateTime.now(),
      },
      { client }
    )
  }
}
