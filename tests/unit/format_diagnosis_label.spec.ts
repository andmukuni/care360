import { test } from '@japa/runner'
import { formatDiagnosisLabel } from '../../inertia/support/screening/screening_json_fields.js'

test.group('formatDiagnosisLabel', () => {
  test('formats structured NTG diagnosis JSON', ({ assert }) => {
    const raw = JSON.stringify([
      {
        type: 'National Treatment Guideline',
        icd11: '',
        level1: 'Disorders Of The Renal System',
        level2: 'hypertension',
        level3: 'Renovascular hypertension',
        path: 'Disorders Of The Renal System > hypertension > Renovascular hypertension',
        certainty: 'confirmed',
        attendance: 'new',
        comments: '',
      },
    ])

    assert.equal(
      formatDiagnosisLabel(raw),
      'Disorders Of The Renal System > hypertension > Renovascular hypertension (confirmed, new)'
    )
  })

  test('returns plain text when value is not JSON', ({ assert }) => {
    assert.equal(formatDiagnosisLabel('Pneumonia'), 'Pneumonia')
  })
})
