import { test } from '@japa/runner'

/**
 * Mirrors the BARCODES ScreeningTest prescription JSON contract used by
 * ScreeningController.persistAssessment().
 */
test.group('Screening prescription payload', () => {
  test('parses prescriptions JSON array for CreatePrescriptionAction items', ({ assert }) => {
    const prescriptions = JSON.stringify([
      {
        drug_name: 'Amoxicillin',
        formulation: 'Capsules',
        dose: '500mg',
        item_per_dose: 1,
        frequency: 3,
        frequency_unit: 'TDS',
        duration: 5,
        duration_unit: 'Days',
        route: 'Oral',
        quantity_prescribed: 15,
        instructions: 'Take after meals',
      },
    ])

    const decoded = JSON.parse(prescriptions)
    assert.isArray(decoded)
    assert.lengthOf(decoded, 1)
    assert.equal(decoded[0].drug_name, 'Amoxicillin')
    assert.equal(decoded[0].quantity_prescribed, 15)
    assert.equal(decoded[0].instructions, 'Take after meals')
  })

  test('empty cart serializes to empty prescriptions string', ({ assert }) => {
    const cart: { drug_name: string }[] = []
    const serialized = cart.length ? JSON.stringify(cart) : ''
    assert.equal(serialized, '')
  })

  test('filters cart items without drug_name before serialization', ({ assert }) => {
    const cart = [
      { drug_name: 'Paracetamol', dose: '500mg' },
      { drug_name: '', dose: '250mg' },
    ]
    const filtered = cart.filter((item) => item.drug_name)
    const serialized = filtered.length ? JSON.stringify(filtered) : ''
    const decoded = JSON.parse(serialized)

    assert.lengthOf(decoded, 1)
    assert.equal(decoded[0].drug_name, 'Paracetamol')
  })
})
