import { test } from '@japa/runner'
import {
  classifyTextFinding,
  deriveInterpretationFromFbc,
  deriveInterpretationFromPanel,
  deriveInterpretationFromValue,
  fbcFieldBadge,
  formSummaryBadge,
  interpretationBadge,
  panelTextFieldBadge,
  parseReferenceBounds,
  quantitativeValueBadge,
} from '../../inertia/support/lab/lab_result_badges.js'

test.group('Lab result badges', () => {
  test('parseReferenceBounds handles common range formats', ({ assert }) => {
    assert.deepEqual(parseReferenceBounds('11.5–16.5'), { min: 11.5, max: 16.5 })
    assert.deepEqual(parseReferenceBounds('< 10 mg/L'), { min: null, max: 10 })
    assert.deepEqual(parseReferenceBounds('70 - 100'), { min: 70, max: 100 })
    assert.deepEqual(parseReferenceBounds('20'), { min: 0, max: 20 })
  })

  test('quantitativeValueBadge flags high and low values', ({ assert }) => {
    assert.equal(quantitativeValueBadge('12', '11.5–16.5')?.label, 'Normal')
    assert.equal(quantitativeValueBadge('20', '11.5–16.5')?.label, 'High')
    assert.equal(quantitativeValueBadge('8', '11.5–16.5')?.label, 'Low')
  })

  test('deriveInterpretationFromValue auto-selects clinical interpretation', ({ assert }) => {
    assert.equal(deriveInterpretationFromValue('15', '20'), 'normal')
    assert.equal(deriveInterpretationFromValue('45', '20'), 'abnormal')
    assert.equal(deriveInterpretationFromValue('12', '11.5–16.5'), 'normal')
  })

  test('interpretationBadge maps clinical interpretation', ({ assert }) => {
    assert.equal(interpretationBadge('abnormal')?.label, 'Abnormal')
    assert.equal(interpretationBadge('normal')?.abnormal, false)
  })

  test('fbcFieldBadge flags out-of-range analyser values', ({ assert }) => {
    assert.equal(fbcFieldBadge('hgb', '12.5')?.label, 'Normal')
    assert.equal(fbcFieldBadge('hgb', '8')?.label, 'Low')
    assert.equal(fbcFieldBadge('wbc', '15')?.label, 'High')
  })

  test('urine chemistry panel classifies dipstick findings', ({ assert }) => {
    assert.equal(panelTextFieldBadge('urine_chemistry', 'protein', 'Negative')?.label, 'Normal')
    assert.equal(panelTextFieldBadge('urine_chemistry', 'protein', 'Positive')?.abnormal, true)
    assert.equal(panelTextFieldBadge('urine_chemistry', 'blood', 'Trace')?.abnormal, true)
    assert.equal(classifyTextFinding('++'), 'elevated')
  })

  test('urine microscopy panel classifies cell counts', ({ assert }) => {
    assert.equal(panelTextFieldBadge('urine_microscopy', 'pus_cells', 'Nil')?.label, 'Normal')
    assert.equal(panelTextFieldBadge('urine_microscopy', 'bacteria', 'Many')?.abnormal, true)
  })

  test('stool analysis panel classifies macroscopy findings', ({ assert }) => {
    assert.equal(panelTextFieldBadge('stool_analysis', 'blood', 'Absent')?.label, 'Normal')
    assert.equal(panelTextFieldBadge('stool_analysis', 'blood', 'Present')?.abnormal, true)
    assert.equal(panelTextFieldBadge('stool_analysis', 'con', 'Watery')?.abnormal, true)
  })

  test('urine macroscopy panel classifies colour and turbidity', ({ assert }) => {
    assert.equal(panelTextFieldBadge('urine_macroscopy', 'colour', 'Pale Yellow')?.label, 'Normal')
    assert.equal(panelTextFieldBadge('urine_macroscopy', 'colour', 'Red')?.abnormal, true)
    assert.equal(panelTextFieldBadge('urine_macroscopy', 'turbidity', 'Clear')?.label, 'Normal')
    assert.equal(panelTextFieldBadge('urine_macroscopy', 'turbidity', 'Very Turbid')?.abnormal, true)
  })

  test('deriveInterpretationFromFbc aggregates high/low fields', ({ assert }) => {
    assert.equal(
      deriveInterpretationFromFbc({ hgb: '12.5', wbc: '7.0' }),
      'normal'
    )
    assert.equal(
      deriveInterpretationFromFbc({ hgb: '8', wbc: '7.0' }),
      'abnormal'
    )
    assert.isNull(deriveInterpretationFromFbc({}))
  })

  test('deriveInterpretationFromPanel aggregates panel fields', ({ assert }) => {
    assert.equal(
      deriveInterpretationFromPanel('urine_chemistry', {
        urine_chem: { protein: 'Negative', glucose: 'Negative', blood: '' },
      }),
      'normal'
    )
    assert.equal(
      deriveInterpretationFromPanel('urine_chemistry', {
        urine_chem: { protein: 'Negative', glucose: 'Positive', blood: '' },
      }),
      'abnormal'
    )
    assert.equal(
      deriveInterpretationFromPanel('urine_macroscopy', {
        urine_macro: { colour: 'Red', turbidity: 'Very Turbid' },
      }),
      'abnormal'
    )
    assert.isNull(
      deriveInterpretationFromPanel('stool_analysis', { stool: { blood: '', con: '' } })
    )
  })

  test('formSummaryBadge reflects worst panel finding', ({ assert }) => {
    assert.equal(
      formSummaryBadge('urine_chemistry', {
        urine_chem: { protein: 'Positive', glucose: 'Negative' },
      })?.label,
      'Abnormal'
    )
    assert.equal(
      formSummaryBadge('fbc', { fbc: { hgb: '12.5', wbc: '7.0' } })?.label,
      'Normal'
    )
  })
})
