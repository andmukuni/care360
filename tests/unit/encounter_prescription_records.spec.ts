import { test } from '@japa/runner'
import PharmacyPrescription from '#models/pharmacy_prescription'
import { dedupePrescriptionsByScreeningRecord } from '#services/encounter/encounter_records'

test.group('Encounter prescription records', () => {
  test('dedupePrescriptionsByScreeningRecord keeps latest per screening record', ({ assert }) => {
    const make = (id: number, screeningRecordId: number | null) => {
      const prescription = new PharmacyPrescription()
      prescription.id = id
      prescription.screeningRecordId = screeningRecordId
      return prescription
    }

    const deduped = dedupePrescriptionsByScreeningRecord([
      make(1, 10),
      make(2, 10),
      make(3, 11),
      make(4, null),
      make(5, null),
    ])

    assert.deepEqual(
      deduped.map((prescription) => prescription.id),
      [2, 3, 5]
    )
  })
})
