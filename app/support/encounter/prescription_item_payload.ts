import { DateTime } from 'luxon'
import type PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'

export function parsePasserBy(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (value === false || value === 0 || value === null || value === undefined) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function formatDateForClient(value: DateTime | null): string | null {
  return value?.toISODate() ?? null
}

export function serializePrescriptionItem(item: PharmacyPrescriptionItem) {
  return {
    id: item.id,
    drug_name: item.drugName,
    strength: item.strength,
    formulation: item.formulation,
    dose: item.dose,
    item_per_dose: item.itemPerDose,
    frequency: item.frequency,
    time_per: item.timePer,
    frequency_unit: item.frequencyUnit,
    duration: item.duration,
    duration_unit: item.durationUnit,
    start_date: formatDateForClient(item.startDate),
    end_date: formatDateForClient(item.endDate),
    quantity_prescribed: item.quantityPrescribed,
    route: item.route,
    is_passer_by: item.isPasserBy,
    instructions: item.instructions,
  }
}
