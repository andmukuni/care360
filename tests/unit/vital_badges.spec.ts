import { test } from '@japa/runner'
import {
  bloodSugarBadge,
  bmiBadge,
  diastolicBpBadge,
  muacBadge,
  oxygenSaturationBadge,
  painScaleBadge,
  pulseBadge,
  respiratoryRateBadge,
  systolicBpBadge,
  temperatureBadge,
  worstVitalSeverity,
} from '../../inertia/support/vital_badges.js'

test.group('temperatureBadge', () => {
  test('returns null for empty input', ({ assert }) => {
    assert.isNull(temperatureBadge(null))
    assert.isNull(temperatureBadge(''))
  })

  test('classifies normal temperature', ({ assert }) => {
    const badge = temperatureBadge(36.8)
    assert.isNotNull(badge)
    assert.equal(badge!.label, 'Normal')
    assert.isFalse(badge!.abnormal)
  })

  test('classifies fever', ({ assert }) => {
    const badge = temperatureBadge(38.5)
    assert.equal(badge!.label, 'Fever')
    assert.isTrue(badge!.abnormal)
  })

  test('classifies low temperature', ({ assert }) => {
    const badge = temperatureBadge(35.2)
    assert.equal(badge!.label, 'Low')
    assert.isTrue(badge!.abnormal)
  })
})

test.group('vital badges', () => {
  test('classifies pulse', ({ assert }) => {
    assert.equal(pulseBadge(72)!.label, 'Normal')
    assert.equal(pulseBadge(110)!.label, 'Fast')
    assert.equal(pulseBadge(45)!.label, 'Bradycardia')
  })

  test('classifies respiratory rate', ({ assert }) => {
    assert.equal(respiratoryRateBadge(16)!.label, 'Normal')
    assert.equal(respiratoryRateBadge(24)!.label, 'Fast')
  })

  test('classifies oxygen saturation', ({ assert }) => {
    assert.equal(oxygenSaturationBadge(98)!.label, 'Normal')
    assert.equal(oxygenSaturationBadge(92)!.label, 'Low')
    assert.equal(oxygenSaturationBadge(88)!.label, 'Critical')
  })

  test('classifies blood pressure', ({ assert }) => {
    assert.equal(systolicBpBadge(120)!.label, 'Normal')
    assert.equal(systolicBpBadge(150)!.label, 'High')
    assert.equal(diastolicBpBadge(80)!.label, 'Normal')
    assert.equal(diastolicBpBadge(95)!.label, 'High')
  })

  test('classifies blood sugar', ({ assert }) => {
    assert.equal(bloodSugarBadge(5.2)!.label, 'Normal')
    assert.equal(bloodSugarBadge(8.5)!.label, 'High')
    assert.equal(bloodSugarBadge(3.2)!.label, 'Low')
  })

  test('classifies muac and pain', ({ assert }) => {
    assert.equal(muacBadge(13)!.label, 'Normal')
    assert.equal(muacBadge(12)!.label, 'MAM')
    assert.equal(painScaleBadge(0)!.label, 'None')
    assert.equal(painScaleBadge(6)!.label, 'Moderate')
  })

  test('classifies bmi', ({ assert }) => {
    assert.equal(bmiBadge(22)!.label, 'Normal')
    assert.equal(bmiBadge(31)!.label, 'Obese (I)')
  })
})

test.group('worstVitalSeverity', () => {
  test('returns critical when any vital is critical', ({ assert }) => {
    assert.equal(
      worstVitalSeverity({ temperature: 40, pulse: 10 }),
      'critical'
    )
  })

  test('returns null when no vitals are set', ({ assert }) => {
    assert.isNull(worstVitalSeverity({}))
  })
})
