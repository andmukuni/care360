import { test } from '@japa/runner'
import {
  extractGcsPoints,
  gcsSeverityLabel,
  isGcsAssessmentNotes,
  parseGcsAssessmentNotes,
} from '../../inertia/support/screening/gcs_assessment.js'

test.group('gcs_assessment support', () => {
  const sample =
    'GCS - Eye: To pain only (not applied to face) (2 points); Verbal: Incomprehensible sounds (2 points); Motor: Extension response in response to pain (2 point); Score: 6/15; Result: HOOO HOOO'

  test('detects gcs assessment notes', ({ assert }) => {
    assert.isTrue(isGcsAssessmentNotes(sample))
    assert.isFalse(isGcsAssessmentNotes('Regular assessment note'))
  })

  test('parses gcs assessment notes into structured fields', ({ assert }) => {
    const parsed = parseGcsAssessmentNotes(sample)

    assert.isNotNull(parsed)
    assert.include(parsed!.eye, 'To pain only')
    assert.include(parsed!.verbal, 'Incomprehensible sounds')
    assert.include(parsed!.motor, 'Extension response')
    assert.equal(parsed!.score, 6)
    assert.equal(parsed!.result, 'HOOO HOOO')
  })

  test('extracts point values from option labels', ({ assert }) => {
    assert.equal(extractGcsPoints('To pain only (not applied to face) (2 points)'), '2')
  })

  test('maps gcs severity labels', ({ assert }) => {
    assert.equal(gcsSeverityLabel(14), 'Mild')
    assert.equal(gcsSeverityLabel(10), 'Moderate')
    assert.equal(gcsSeverityLabel(6), 'Severe')
  })
})
