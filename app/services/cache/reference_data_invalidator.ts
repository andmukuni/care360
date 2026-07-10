import cache from '@adonisjs/cache/services/main'
import {
  householdAliasesFromModel,
  householdAliasesFromRow,
  householdRefKeys,
  lookupCodeKey,
  medicationIdKey,
  patientAliasesFromModel,
  patientAliasesFromRow,
  patientRefKeys,
  REFDATA_TAGS,
  testTypeIdKey,
  type HouseholdRefAliases,
  type PatientRefAliases,
} from '#services/cache/reference_data_keys'

export default class ReferenceDataInvalidator {
  static async invalidatePatient(
    current: PatientRefAliases,
    previous: PatientRefAliases | null = null
  ): Promise<void> {
    const keys = new Set<string>([
      ...patientRefKeys(current),
      ...(previous ? patientRefKeys(previous) : []),
    ])

    for (const alias of [current, previous]) {
      if (!alias) continue
      const code = alias.patientId ?? alias.barcode
      if (code) keys.add(lookupCodeKey(code))
      if (alias.barcode && alias.barcode !== alias.patientId) {
        keys.add(lookupCodeKey(alias.barcode))
      }
    }

    if (keys.size > 0) {
      await cache.deleteMany({ keys: [...keys] })
    }

    await cache.deleteByTag({ tags: [REFDATA_TAGS.patients] })
  }

  static async invalidateHousehold(
    current: HouseholdRefAliases,
    previous: HouseholdRefAliases | null = null
  ): Promise<void> {
    const keys = new Set<string>([
      ...householdRefKeys(current),
      ...(previous ? householdRefKeys(previous) : []),
    ])

    if (keys.size > 0) {
      await cache.deleteMany({ keys: [...keys] })
    }

    await cache.deleteByTag({ tags: [REFDATA_TAGS.households] })
  }

  static async invalidateMedication(id: number | string): Promise<void> {
    await cache.deleteMany({ keys: [medicationIdKey(id)] })
    await cache.deleteByTag({ tags: [REFDATA_TAGS.medications] })
  }

  static async invalidateTestType(id: number | string): Promise<void> {
    await cache.deleteMany({ keys: [testTypeIdKey(id)] })
    await cache.deleteByTag({ tags: [REFDATA_TAGS.testTypes] })
  }

  static async patientChangedFromRow(
    current: Record<string, unknown>,
    previous: Record<string, unknown> | null = null
  ): Promise<void> {
    await this.invalidatePatient(
      patientAliasesFromRow(current),
      previous ? patientAliasesFromRow(previous) : null
    )
  }

  static async householdChangedFromRow(
    current: Record<string, unknown>,
    previous: Record<string, unknown> | null = null
  ): Promise<void> {
    await this.invalidateHousehold(
      householdAliasesFromRow(current),
      previous ? householdAliasesFromRow(previous) : null
    )
  }

  static async patientChangedFromModel(
    current: { id: number; patientId: string; barcode?: string | null },
    previous: { id: number; patientId: string; barcode?: string | null } | null = null
  ): Promise<void> {
    await this.invalidatePatient(
      patientAliasesFromModel(current),
      previous ? patientAliasesFromModel(previous) : null
    )
  }

  static async householdChangedFromModel(
    current: { id: number; householdId: string; barcode?: string | null },
    previous: { id: number; householdId: string; barcode?: string | null } | null = null
  ): Promise<void> {
    await this.invalidateHousehold(
      householdAliasesFromModel(current),
      previous ? householdAliasesFromModel(previous) : null
    )
  }

  static async invalidatePatientsAndHouseholds(): Promise<void> {
    await cache.deleteByTag({ tags: [REFDATA_TAGS.patients, REFDATA_TAGS.households] })
  }
}
