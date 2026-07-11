import cache from '@adonisjs/cache/services/main'
import env from '#start/env'
import {
  REFDATA_KEYS,
  REFDATA_TAGS,
  lookupCodeKey,
  medicationIdKey,
  testTypeIdKey,
} from '#services/cache/reference_data_keys'

const REFDATA_TTL = env.get('CACHE_REF_DATA_TTL', '24h')

function isPatientsFullListEnabled(): boolean {
  return env.get('CACHE_PATIENTS_FULL_LIST', true)
}

export default class ReferenceDataCache {
  static ttl(): string {
    return REFDATA_TTL
  }

  static patientsFullListEnabled(): boolean {
    return isPatientsFullListEnabled()
  }

  static async patientsAll<T>(factory: () => Promise<T>): Promise<T> {
    if (!isPatientsFullListEnabled()) {
      return factory()
    }

    return cache.getOrSet({
      key: REFDATA_KEYS.patientsAll,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.patients],
      factory,
    })
  }

  static async patientsKpis<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.patientsKpis,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.patients],
      factory,
    })
  }

  static async patientByRef<T>(ref: string, factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: `refdata:patients:ref:${ref.trim()}`,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.patients],
      factory,
    })
  }

  static async lookupByCode<T>(code: string, factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: lookupCodeKey(code),
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.patients],
      factory,
    })
  }

  static async householdsAll<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.householdsAll,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.households],
      factory,
    })
  }

  static async householdsKpis<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.householdsKpis,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.households],
      factory,
    })
  }

  static async householdByRef<T>(ref: string, factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: `refdata:households:ref:${ref.trim()}`,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.households],
      factory,
    })
  }

  static async medicationsAll<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.medicationsAll,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.medications],
      factory,
    })
  }

  static async medicationCategories<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.medicationsCategories,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.medications],
      factory,
    })
  }

  static async medicationById<T>(id: number | string, factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: medicationIdKey(id),
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.medications],
      factory,
    })
  }

  static async testTypesAll<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.testTypesAll,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.testTypes],
      factory,
    })
  }

  static async testTypeCategories<T>(factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: REFDATA_KEYS.testTypesCategories,
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.testTypes],
      factory,
    })
  }

  static async testTypeById<T>(id: number | string, factory: () => Promise<T>): Promise<T> {
    return cache.getOrSet({
      key: testTypeIdKey(id),
      ttl: REFDATA_TTL,
      tags: [REFDATA_TAGS.testTypes],
      factory,
    })
  }

  /**
   * Pre-populate catalog caches on boot. Failures are logged but do not block startup.
   */
  static async warmCatalogs(): Promise<void> {
    const db = (await import('@adonisjs/lucid/services/db')).default
    const Medication = (await import('#models/medication')).default
    const TestType = (await import('#models/test_type')).default

    const warmers = [
      () =>
        this.medicationsAll(async () => {
          const rows = await Medication.query()
            .preload('units', (unitQuery) => unitQuery.select('id', 'name', 'form', 'strength'))
            .orderBy('category')
            .orderBy('name')
          return rows.map((m) => m.serialize())
        }),
      () =>
        this.medicationCategories(async () => {
          const rows = await db.from('medications').distinct('category').orderBy('category')
          return rows.map((r) => String(r.category ?? ''))
        }),
      () =>
        this.testTypesAll(async () => {
          const rows = await TestType.query()
            .preload('labSpecimenType')
            .preload('labResultForm')
            .orderBy('name')
          return rows.map((t) => t.serialize())
        }),
      () =>
        this.testTypeCategories(async () => {
          const rows = await db
            .from('test_types')
            .whereNotNull('description')
            .where('description', '!=', '')
            .distinct('description')
            .orderBy('description')
          return rows.map((r) => String(r.description ?? ''))
        }),
    ]

    if (isPatientsFullListEnabled()) {
      warmers.push(
        () =>
          this.patientsAll(async () => {
            return db.from('patients').orderBy('source_created_at', 'desc').orderBy('id', 'desc')
          }),
        () =>
          this.householdsAll(async () => {
            return db.from('households').orderBy('source_created_at', 'desc').orderBy('id', 'desc')
          })
      )
    }

    await Promise.allSettled(warmers.map((warmer) => warmer()))
  }
}
