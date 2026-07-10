import { test } from '@japa/runner'
import {
  buildPresumptiveTbDiagnosisEntry,
  hasPresumptiveTbIndicators,
  mergePresumptiveTbDiagnosis,
  resolvePresumptiveTbLevel3,
} from '../../inertia/support/screening/presumptive_tb.js'

test.group('presumptive_tb support', () => {
  test('detects presumptive TB indicators from symptoms', ({ assert }) => {
    assert.isTrue(hasPresumptiveTbIndicators(['cough'], ''))
    assert.isTrue(hasPresumptiveTbIndicators([], 'Fever'))
    assert.isFalse(hasPresumptiveTbIndicators([], ''))
  })

  test('chooses pulmonary tuberculosis for respiratory symptoms', ({ assert }) => {
    assert.equal(resolvePresumptiveTbLevel3(['cough', 'fever']), 'Pulmonary tuberculosis')
    assert.equal(resolvePresumptiveTbLevel3(['fever', 'weight_loss']), 'Extrapulmonary tuberculosis')
  })

  test('builds NTG presumptive TB diagnosis entry', ({ assert }) => {
    const entry = buildPresumptiveTbDiagnosisEntry(
      ['cough', 'night_sweats'],
      { cough: 'Cough', night_sweats: 'Night Sweats' },
      'Fever'
    )

    assert.equal(entry.level1, 'Infections')
    assert.equal(entry.level2, 'Tuberculosis')
    assert.equal(entry.level3, 'Pulmonary tuberculosis')
    assert.equal(entry.certainty, 'Possible')
    assert.equal(entry.attendance, 'First visit')
    assert.include(entry.comments, 'Cough')
    assert.include(entry.comments, 'Constitutional: Fever')
  })

  test('merges presumptive TB diagnosis without duplicating tuberculosis entries', ({ assert }) => {
    const entry = buildPresumptiveTbDiagnosisEntry(['fever'], { fever: 'Fever' }, '')
    const merged = mergePresumptiveTbDiagnosis('', entry)
    const parsed = JSON.parse(merged)

    assert.lengthOf(parsed, 1)
    assert.equal(parsed[0].level2, 'Tuberculosis')

    const again = mergePresumptiveTbDiagnosis(merged, entry)
    assert.equal(again, merged)
  })
})
