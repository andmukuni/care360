import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import LabRequestItem from '#models/lab_request_item'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import { getLabRequest, getLatestPrescription } from '#services/encounter/encounter_records'

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
  const prescription = await getLatestPrescription(encounterId, client)
  if (!prescription) return false

  const item = await PharmacyPrescriptionItem.query({ client })
    .where('pharmacy_prescription_id', prescription.id)
    .first()

  return item !== null
}
