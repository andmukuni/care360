import { test } from '@japa/runner'
import {
  householdRefKeys,
  lookupCodeKey,
  patientRefKeys,
  patientAliasesFromRow,
  householdAliasesFromRow,
} from '#services/cache/reference_data_keys'

test.group('Reference data cache keys', () => {
  test('builds patient ref alias keys for id, patient_id, and barcode', ({ assert }) => {
    const keys = patientRefKeys({
      id: 42,
      patientId: 'P-ABC123',
      barcode: 'PXXXXXXXX',
    })

    assert.deepEqual(keys, [
      'refdata:patients:ref:42',
      'refdata:patients:ref:P-ABC123',
      'refdata:patients:ref:PXXXXXXXX',
    ])
  })

  test('builds household ref alias keys', ({ assert }) => {
    const keys = householdRefKeys({
      id: 7,
      householdId: 'HH-20260710-0001',
      barcode: 'HXXXXXXXX',
    })

    assert.deepEqual(keys, [
      'refdata:households:ref:7',
      'refdata:households:ref:HH-20260710-0001',
      'refdata:households:ref:HXXXXXXXX',
    ])
  })

  test('lookup code key trims whitespace', ({ assert }) => {
    assert.equal(lookupCodeKey('  P-123  '), 'refdata:lookup:code:P-123')
  })

  test('extracts patient aliases from snake_case rows', ({ assert }) => {
    assert.deepEqual(patientAliasesFromRow({
      id: 1,
      patient_id: 'P-1',
      barcode: 'BC1',
    }), {
      id: 1,
      patientId: 'P-1',
      barcode: 'BC1',
    })
  })

  test('extracts household aliases from snake_case rows', ({ assert }) => {
    assert.deepEqual(householdAliasesFromRow({
      id: 2,
      household_id: 'HH-1',
      barcode: 'HB1',
    }), {
      id: 2,
      householdId: 'HH-1',
      barcode: 'HB1',
    })
  })

  test('ignores empty alias values', ({ assert }) => {
    const keys = patientRefKeys({ id: '', patientId: '  ', barcode: null })
    assert.deepEqual(keys, [])
  })
})
