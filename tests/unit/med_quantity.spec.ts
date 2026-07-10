import { test } from '@japa/runner'
import { MedQuantity } from '../../inertia/support/med_quantity.js'

test.group('MedQuantity', () => {
  test('computes tablet quantity from dose frequency and duration', ({ assert }) => {
    const result = MedQuantity.compute({
      itemPerDose: 2,
      frequency: 3,
      duration: 7,
      durationUnit: 'Days',
      formulation: 'Tablets',
    })

    assert.equal(result.quantity, 42)
    assert.include(result.hint, '42')
  })

  test('STAT preset yields single dose quantity', ({ assert }) => {
    const result = MedQuantity.compute({
      itemPerDose: 1,
      frequency: '',
      frequencyUnit: 'STAT',
      duration: 7,
      durationUnit: 'Days',
      formulation: 'Tablets',
    })

    assert.equal(result.quantity, 1)
    assert.include(result.hint, 'single dose')
  })

  test('detects tablet formulation from medication form', ({ assert }) => {
    const formulation = MedQuantity.detectFormulation({
      name: 'Paracetamol',
      form: 'tablet',
      units: ['Tablet 500 mg'],
    })

    assert.equal(formulation, 'Tablets')
  })

  test('returns null quantity when required fields are missing', ({ assert }) => {
    const result = MedQuantity.compute({
      itemPerDose: 0,
      frequency: 0,
      duration: 0,
      formulation: 'Tablets',
    })

    assert.isNull(result.quantity)
    assert.include(result.hint, 'Fill in dose')
  })
})
