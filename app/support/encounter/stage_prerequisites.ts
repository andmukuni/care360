import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Encounter from '#models/encounter'
import LabRequestItem from '#models/lab_request_item'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { getLabRequest } from '#services/encounter/encounter_records'

export const PHARMACY_NO_PRESCRIPTION_CLOSURE_NOTE =
  'Closed automatically — queued to Pharmacy without prescription medication.'

export async function hasLabRequestWithItems(
  encounterId: number,
  client?: TransactionClientContract
): Promise<boolean> {
  const labRequest = await getLabRequest(encounterId, client)
  if (!labRequest) return false

  const item = await LabRequestItem.query({ client })
    .where('lab_request_id', labRequest.id)
    .first()

  return item !== null
}

export async function hasPrescriptionWithItems(
  encounterId: number,
  client?: TransactionClientContract
): Promise<boolean> {
  const item = await PharmacyPrescriptionItem.query({ client })
    .whereHas('pharmacyPrescription', (query) => {
      query.where('encounter_id', encounterId)
    })
    .first()

  return item !== null
}

export function isPharmacyEncounterCloseableWithoutPrescription(input: {
  stage: EncounterStage | string
  status: EncounterStatus | string
  isLocked: boolean
  hasPrescriptionItems: boolean
}): boolean {
  return (
    input.stage === EncounterStage.Pharmacy &&
    [EncounterStatus.Queued, EncounterStatus.InProgress].includes(input.status as EncounterStatus) &&
    !input.isLocked &&
    !input.hasPrescriptionItems
  )
}

export function pharmacyEncountersWithoutPrescriptionQuery() {
  return Encounter.query()
    .where('current_stage', EncounterStage.Pharmacy)
    .whereIn('current_status', [EncounterStatus.Queued, EncounterStatus.InProgress])
    .where('is_locked', false)
    .whereDoesntHave('pharmacyPrescriptions', (query) => {
      query.whereHas('pharmacyPrescriptionItems')
    })
}
