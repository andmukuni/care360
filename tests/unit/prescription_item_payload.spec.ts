import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { parsePasserBy, serializePrescriptionItem } from '#support/encounter/prescription_item_payload'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'

test.group('Prescription item payload', () => {
  test('parsePasserBy handles string and boolean values', ({ assert }) => {
    assert.isFalse(parsePasserBy('0'))
    assert.isFalse(parsePasserBy('false'))
    assert.isFalse(parsePasserBy(false))
    assert.isTrue(parsePasserBy('1'))
    assert.isTrue(parsePasserBy('yes'))
    assert.isTrue(parsePasserBy(true))
  })

  test('serializePrescriptionItem includes all prescription form fields', ({ assert }) => {
    const item = new PharmacyPrescriptionItem()
    item.id = 12
    item.drugName = 'Aceclofenac Paracetamol'
    item.strength = '100 mg'
    item.formulation = 'Tablets'
    item.dose = 'Tablet 100 mg'
    item.itemPerDose = 10
    item.frequency = '1'
    item.timePer = 'Day'
    item.frequencyUnit = 'STAT'
    item.duration = '7'
    item.durationUnit = 'Weeks'
    item.startDate = DateTime.fromISO('2026-07-08')
    item.endDate = DateTime.fromISO('2026-08-26')
    item.quantityPrescribed = 10
    item.route = 'Oral'
    item.isPasserBy = true
    item.instructions = 'Take after meals'

    const payload = serializePrescriptionItem(item)

    assert.equal(payload.drug_name, 'Aceclofenac Paracetamol')
    assert.equal(payload.item_per_dose, 10)
    assert.equal(payload.frequency_unit, 'STAT')
    assert.equal(payload.time_per, 'Day')
    assert.equal(payload.duration_unit, 'Weeks')
    assert.equal(payload.start_date, '2026-07-08')
    assert.equal(payload.end_date, '2026-08-26')
    assert.equal(payload.quantity_prescribed, 10)
    assert.isTrue(payload.is_passer_by)
    assert.equal(payload.instructions, 'Take after meals')
  })
})
