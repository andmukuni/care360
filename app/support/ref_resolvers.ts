import db from '@adonisjs/lucid/services/db'
import ReferenceDataCache from '#services/cache/reference_data_cache'

/**
 * Shared ref resolvers for patients and households. Wraps DB lookups with
 * Redis-backed per-ref caching.
 */
export async function findPatientRowByRef(ref: string): Promise<Record<string, any> | null> {
  const trimmed = ref.trim()
  if (trimmed === '') return null

  return ReferenceDataCache.patientByRef(trimmed, async () => {
    const row = await db
      .from('patients')
      .where('patient_id', trimmed)
      .orWhere('barcode', trimmed)
      .orWhere('id', /^\d+$/.test(trimmed) ? Number(trimmed) : 0)
      .first()

    return row ?? null
  })
}

export async function findHouseholdRowByRef(ref: string): Promise<Record<string, any> | null> {
  const trimmed = ref.trim()
  if (trimmed === '') return null

  return ReferenceDataCache.householdByRef(trimmed, async () => {
    const row = await db
      .from('households')
      .where('barcode', trimmed)
      .orWhere('household_id', trimmed)
      .orWhere('id', /^\d+$/.test(trimmed) ? Number(trimmed) : 0)
      .first()

    return row ?? null
  })
}

export async function findAllPatientRows(): Promise<Record<string, any>[]> {
  return ReferenceDataCache.patientsAll(async () => {
    return db.from('patients').orderBy('source_created_at', 'desc').orderBy('id', 'desc')
  })
}

export async function findAllHouseholdRows(): Promise<Record<string, any>[]> {
  return ReferenceDataCache.householdsAll(async () => {
    return db.from('households').orderBy('source_created_at', 'desc').orderBy('id', 'desc')
  })
}
