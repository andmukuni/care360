import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * HTTP-level smoke test for the screening prescription save contract.
 * Requires a configured database with the full HMS schema and at least one
 * clinician user with screening permissions.
 */
test.group('Screening prescription save', (group) => {
  group.each.setup(() => testUtils.httpServer().start())

  test.skip('save-draft accepts prescriptions JSON payload', async ({ client, assert }) => {
    const response = await client
      .post('/screening/1/save-draft')
      .json({
        complaints: 'Sore throat',
        provisional_diagnosis: 'Pharyngitis',
        final_diagnosis: 'Pharyngitis',
        lab_requested: false,
        prescriptions: JSON.stringify([
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
        ]),
      })
      .header('Accept', 'application/json')

    // Unauthenticated or missing encounter returns redirect/401/404 — not 500.
    assert.notEqual(response.status(), 500)
  })
})
