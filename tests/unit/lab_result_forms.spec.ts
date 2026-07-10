import { test } from '@japa/runner'
import {
  deriveFormKey,
  renderTemplateKeyForForm,
  resolveRenderType,
  usesCustomFields,
} from '#support/lab/lab_result_form_maps'
import LabResultForm from '#models/lab_result_form'
import {
  initializeFormStateForTest,
  serializeLabResultFormState,
  type LabResultFormMaps,
} from '../../inertia/support/lab/lab_result_forms.js'

const maps: LabResultFormMaps = {
  testFormKeyMap: {
    FBC: 'fbc',
    'MPS RDT': 'rapid_test',
    'HIV 1&2': 'reactive_test',
    'CUSTOM PANEL': 'custom_panel',
    'URINE CHEM': 'urine_chemistry',
  },
  formRenderMap: {
    fbc: 'fbc',
    rapid_test: 'rapid_test',
    reactive_test: 'reactive_test',
    custom_panel: 'custom',
    quantitative: 'quantitative',
    urine_chemistry: 'urine_chemistry',
  },
  formLabelMap: {
    fbc: 'Full Blood Count',
    custom_panel: 'Custom Panel',
  },
  formFieldsMap: {
    custom_panel: [
      {
        key: 'finding',
        label: 'Finding',
        type: 'text',
        options: [],
        placeholder: null,
        required: true,
      },
    ],
  },
}

test.group('Lab result form maps', () => {
  test('deriveFormKey resolves test name to configured form key', ({ assert }) => {
    assert.equal(deriveFormKey('FBC', maps.testFormKeyMap), 'fbc')
    assert.equal(deriveFormKey('unknown test', maps.testFormKeyMap), 'quantitative')
  })

  test('resolveRenderType maps form key to render template', ({ assert }) => {
    assert.equal(resolveRenderType('fbc', maps.formRenderMap), 'fbc')
    assert.equal(resolveRenderType('custom_panel', maps.formRenderMap), 'custom')
  })

  test('renderTemplateKeyForForm prefers custom fields over template key', ({ assert }) => {
    const form = new LabResultForm()
    form.isSystem = false
    form.key = 'custom_panel'
    form.templateKey = 'quantitative'

    assert.equal(renderTemplateKeyForForm(form, 2), 'custom')
    assert.equal(renderTemplateKeyForForm(form, 0), 'quantitative')
  })

  test('usesCustomFields is false for system forms', ({ assert }) => {
    const form = new LabResultForm()
    form.isSystem = true
    form.key = 'fbc'

    assert.isFalse(usesCustomFields(form, 3))
  })
})

test.group('Lab result form serializer', () => {
  test('serializeLabResultFormState serializes rapid test selection', ({ assert }) => {
    const state = initializeFormStateForTest('MPS RDT', maps)
    state.value = 'Positive'
    state.remarks = 'Pf detected'

    const serialized = serializeLabResultFormState(state, maps)
    assert.isNotNull(serialized)
    assert.equal(serialized?.result_value, 'Positive')
    assert.equal(serialized?.remarks, 'Pf detected')
  })

  test('serializeLabResultFormState serializes FBC panel fields', ({ assert }) => {
    const state = initializeFormStateForTest('FBC', maps)
    state.fbc.hgb = '12.5'
    state.fbc.wbc = '7.2'

    const serialized = serializeLabResultFormState(state, maps)
    assert.isNotNull(serialized)
    assert.equal(serialized?.result_value, 'FBC Panel')
    assert.include(serialized?.result_text ?? '', 'HGB: 12.5 g/dL')
    assert.include(serialized?.result_text ?? '', 'WBC: 7.2')
  })

  test('initializeFormStateForTest hydrates saved custom form values', ({ assert }) => {
    const state = initializeFormStateForTest('CUSTOM PANEL', maps, {
      result_value: 'Custom Panel',
      result_text: 'Finding: Positive',
      reference_range: null,
      interpretation: 'abnormal',
      remarks: null,
    })

    assert.equal(state.formType, 'custom')
    assert.equal(state.custom.finding, 'Positive')
    assert.equal(state.interp, 'abnormal')
  })

  test('initializeFormStateForTest auto-derives FBC interpretation on hydrate', ({ assert }) => {
    const state = initializeFormStateForTest('FBC', maps, {
      result_value: 'FBC Panel',
      result_text: 'HGB: 8 g/dL | WBC: 7.2',
      reference_range: null,
      interpretation: null,
      remarks: null,
    })

    assert.equal(state.interp, 'abnormal')
  })

  test('initializeFormStateForTest auto-derives urine chemistry interpretation on hydrate', ({
    assert,
  }) => {
    const state = initializeFormStateForTest('URINE CHEM', maps, {
      result_value: 'Urine Chemistry',
      result_text: 'PROTEIN: Negative | GLUCOSE: Positive',
      reference_range: null,
      interpretation: null,
      remarks: null,
    })

    assert.equal(state.formType, 'urine_chemistry')
    assert.equal(state.interp, 'abnormal')
  })

  test('serializeLabResultFormState returns null when custom required field missing', ({ assert }) => {
    const state = initializeFormStateForTest('CUSTOM PANEL', maps)
    const serialized = serializeLabResultFormState(state, maps)
    assert.isNull(serialized)
  })
})
