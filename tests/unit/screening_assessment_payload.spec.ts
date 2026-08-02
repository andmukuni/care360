import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { normalizeScreeningAssessmentPayload } from '#support/encounter/coerce'
import { screeningAssessmentValidator } from '#validators/staff/screening'

test.group('Screening assessment payload', () => {
  test('normalizeScreeningAssessmentPayload converts empty date strings to null', ({
    assert,
  }) => {
    const normalized = normalizeScreeningAssessmentPayload({
      expected_delivery_date: '',
      last_menstrual_period: '',
      cervical_screening_date: '',
    })

    assert.isNull(normalized.expected_delivery_date)
    assert.isNull(normalized.last_menstrual_period)
    assert.isNull(normalized.cervical_screening_date)
  })

  test('normalizeScreeningAssessmentPayload converts empty numeric strings to null', ({
    assert,
  }) => {
    const normalized = normalizeScreeningAssessmentPayload({
      gravida: '',
      birth_weight: '',
    })

    assert.isNull(normalized.gravida)
    assert.isNull(normalized.birth_weight)
  })

  test('screeningAssessmentValidator accepts normalized empty gyn date fields', async ({
    assert,
  }) => {
    const normalized = normalizeScreeningAssessmentPayload({
      complaints: 'Headache',
      expected_delivery_date: '',
      last_menstrual_period: '',
      currently_pregnant: false,
      lab_requested: false,
    })

    const data = await screeningAssessmentValidator.validate(normalized)
    assert.isNull(data.expected_delivery_date)
    assert.isNull(data.last_menstrual_period)
  })
})
