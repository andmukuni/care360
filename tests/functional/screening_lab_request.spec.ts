import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * HTTP-level smoke test for the screening lab request save contract.
 * Requires a configured database with the full HMS schema and at least one
 * clinician user with screening permissions.
 */
test.group('Screening lab request save', (group) => {
  group.each.setup(() => testUtils.httpServer().start())

  test.skip('save-draft accepts lab_items JSON payload', async ({ client, assert }) => {
    const response = await client
      .post('/screening/1/save-draft')
      .json({
        complaints: 'Fever and cough',
        provisional_diagnosis: 'Pneumonia',
        final_diagnosis: 'Pneumonia',
        lab_requested: true,
        lab_priority_level: 'urgent',
        lab_request_notes: 'Rule out TB',
        lab_items: JSON.stringify([
          {
            test_name: 'Full Blood Count',
            test_code: null,
            specimen_type: 'EDTA Blood',
            lab_specimen_type_id: null,
            test_group: 'Haematology',
            instructions: 'Fasting not required',
          },
        ]),
      })
      .header('Accept', 'application/json')

    // Unauthenticated or missing encounter returns redirect/401/404 — not 500.
    assert.notEqual(response.status(), 500)
  })
})
