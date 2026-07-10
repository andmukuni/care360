import { test } from '@japa/runner'
import cache from '@adonisjs/cache/services/main'
import ReferenceDataCache from '#services/cache/reference_data_cache'
import ReferenceDataInvalidator from '#services/cache/reference_data_invalidator'
import { lookupCodeKey } from '#services/cache/reference_data_keys'

test.group('Reference data cache service', () => {
  test('getOrSet caches factory result and invalidation clears tagged entries', async ({ assert }) => {
    let factoryCalls = 0

    const first = await ReferenceDataCache.lookupByCode('P-CACHE-TEST', async () => {
      factoryCalls++
      return { patient_id: 'P-CACHE-TEST', barcode: 'P-CACHE-TEST', full_name: 'Cache Patient' }
    })

    const second = await ReferenceDataCache.lookupByCode('P-CACHE-TEST', async () => {
      factoryCalls++
      return { patient_id: 'P-CACHE-TEST', barcode: 'P-CACHE-TEST', full_name: 'Cache Patient' }
    })

    assert.deepEqual(first, second)
    assert.equal(factoryCalls, 1)

    await ReferenceDataInvalidator.invalidatePatient(
      { patientId: 'P-CACHE-TEST', barcode: 'P-CACHE-TEST' },
      null
    )

    const hasLookup = await cache.has({ key: lookupCodeKey('P-CACHE-TEST') })
    assert.isFalse(hasLookup)

    factoryCalls = 0
    await ReferenceDataCache.lookupByCode('P-CACHE-TEST', async () => {
      factoryCalls++
      return { patient_id: 'P-CACHE-TEST', barcode: 'P-CACHE-TEST', full_name: 'Cache Patient' }
    })

    assert.equal(factoryCalls, 1)
  })

  test('patient update invalidation clears previous barcode aliases', async ({ assert }) => {
    await ReferenceDataCache.patientByRef('OLD-BARCODE', async () => ({
      id: 9,
      patient_id: 'P-9',
      barcode: 'OLD-BARCODE',
    }))
    await ReferenceDataCache.patientByRef('P-9', async () => ({
      id: 9,
      patient_id: 'P-9',
      barcode: 'OLD-BARCODE',
    }))

    await ReferenceDataInvalidator.patientChangedFromRow(
      { id: 9, patient_id: 'P-9', barcode: 'NEW-BARCODE' },
      { id: 9, patient_id: 'P-9', barcode: 'OLD-BARCODE' }
    )

    assert.isFalse(await cache.has({ key: 'refdata:patients:ref:OLD-BARCODE' }))
    assert.isFalse(await cache.has({ key: 'refdata:patients:ref:NEW-BARCODE' }))
    assert.isFalse(await cache.has({ key: lookupCodeKey('OLD-BARCODE') }))
  })
})
