import { DateTime } from 'luxon'
import Encounter from '#models/encounter'
import ClinicalSuggestionService from '#services/clinical/clinical_suggestion_service'
import { serializeLabItemsWithResults } from '#support/encounter/lab_item_payload'
import type { StageScope } from '#support/clinical/clinical_suggestion_types'
import type User from '#models/user'

/**
 * Load encounter relations needed for suggestions and return the payload.
 */
export async function loadClinicalSuggestions(encounterId: number, stage: StageScope) {
  const encounter = await Encounter.findOrFail(encounterId)
  await encounter.load('triageRecords')
  await encounter.load('screeningRecords')
  await encounter.load('labRequests', (q) => {
    q.preload('labRequestItems')
    q.preload('labResults', (r) => {
      r.preload('verifiedByUser')
      r.preload('releasedByUser')
    })
  })

  const lr = encounter.labRequests?.[0] ?? null
  const formatDate = (value: DateTime | null | undefined, format = 'dd LLL yyyy, HH:mm') =>
    value?.toFormat(format) ?? null
  const userBadge = (user: User | null | undefined) =>
    user ? { name: user.name, role: null } : null

  const labItems = lr ? serializeLabItemsWithResults(lr, { formatDate, userBadge }) : []
  const context = ClinicalSuggestionService.buildContextFromEncounter(encounter, stage, labItems)

  return new ClinicalSuggestionService().suggestForEncounter(encounter, context)
}
