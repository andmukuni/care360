import { test } from '@japa/runner'
import {
  countPharmacyClosedEncounters,
  countPharmacyPartiallyDispensedEncounters,
  paginateCachedPharmacyPrimaryQueue,
  preloadPharmacyQueueEncounter,
} from '#support/queue/stage_queue_helpers'
import PharmacyPrescription from '#models/pharmacy_prescription'

test.group('Pharmacy queue load', () => {
  test('primary queue paginates without error', async ({ assert }) => {
    const result = await paginateCachedPharmacyPrimaryQueue({
      queuedPage: 1,
      progressPage: 1,
      currentUserId: null,
      preload: preloadPharmacyQueueEncounter,
    })
    assert.isArray(result.queued.data)
    assert.isArray(result.inProgress.data)
  }).timeout(60_000)

  test('partially dispensed count succeeds', async ({ assert }) => {
    const count = await countPharmacyPartiallyDispensedEncounters()
    assert.isNumber(count)
  }).timeout(60_000)

  test('closed count succeeds', async ({ assert }) => {
    const count = await countPharmacyClosedEncounters()
    assert.isNumber(count)
  }).timeout(60_000)

  test('prescriptions list preloads without error', async ({ assert }) => {
    const rows = await PharmacyPrescription.query()
      .preload('patient')
      .preload('encounter')
      .preload('prescribedByUser')
      .withCount('pharmacyPrescriptionItems')
      .orderBy('prescribed_at', 'desc')
      .limit(5)
    assert.isArray(rows)
  }).timeout(60_000)
})
