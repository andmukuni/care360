import { test } from '@japa/runner'
import Encounter from '#models/encounter'
import PossibleResult from '#models/possible_result'
import ClinicalSuggestionService, {
  type EncounterClinicalContext,
} from '#services/clinical/clinical_suggestion_service'
import type { SerializedLabItem } from '#support/encounter/lab_item_payload'
import { normalizeMatchValue, testNamesMatch } from '#support/clinical/test_name_normalizer'

function makeRule(overrides: Partial<PossibleResult> & Pick<PossibleResult, 'id' | 'targetField'>): PossibleResult {
  const rule = new PossibleResult()
  rule.id = overrides.id
  rule.testName = overrides.testName ?? null
  rule.testTypeId = overrides.testTypeId ?? null
  rule.matchKind = overrides.matchKind ?? 'interpretation'
  rule.matchValue = overrides.matchValue ?? null
  rule.targetField = overrides.targetField
  rule.suggestionText = overrides.suggestionText ?? null
  rule.prescriptionPayload = overrides.prescriptionPayload ?? null
  rule.stageScope = overrides.stageScope ?? JSON.stringify(['screening_review', 'screening'])
  rule.triggerContext = overrides.triggerContext ?? 'lab_result'
  rule.contextMatch = overrides.contextMatch ?? null
  rule.priority = overrides.priority ?? 10
  rule.isActive = overrides.isActive ?? true
  rule.notes = overrides.notes ?? null
  return rule
}

function labItem(
  testName: string,
  result: { result_value?: string | null; result_text?: string | null; interpretation?: string | null }
): SerializedLabItem {
  return {
    id: 1,
    test_name: testName,
    specimen_type: null,
    instructions: null,
    status: 'completed',
    result: {
      id: 1,
      result_value: result.result_value ?? null,
      result_text: result.result_text ?? null,
      reference_range: null,
      interpretation: result.interpretation ?? null,
      remarks: null,
      result_status: 'final',
      verified_at: null,
      released_to_patient_at: null,
      verified_by_badge: null,
    },
  }
}

function stubRules(rules: PossibleResult[]) {
  const originalQuery = PossibleResult.query
  PossibleResult.query = () =>
    ({
      where: () => ({
        orderBy: async () => rules,
      }),
    }) as ReturnType<typeof PossibleResult.query>

  return () => {
    PossibleResult.query = originalQuery
  }
}

test.group('Clinical suggestion service', (group) => {
  group.each.teardown(() => {
    // Restore if a test failed before calling restore.
  })

  test('MPS RDT positive suggests malaria diagnosis and ACT prescription', async ({ assert }) => {
    const rules = [
      makeRule({
        id: 1,
        testName: 'MPS RDT',
        matchKind: 'value_equals',
        matchValue: 'Positive',
        targetField: 'final_diagnosis',
        suggestionText: 'Uncomplicated malaria (RDT positive)',
        stageScope: JSON.stringify(['screening_review']),
      }),
      makeRule({
        id: 2,
        testName: 'MPS RDT',
        matchKind: 'value_equals',
        matchValue: 'Positive',
        targetField: 'prescription',
        prescriptionPayload: JSON.stringify([
          {
            drug_name: 'Artemether-Lumefantrine',
            dose: '80/480mg',
            frequency: 'BD',
            duration: '3 days',
            route: 'Oral',
            quantity_prescribed: 6,
          },
        ]),
        stageScope: JSON.stringify(['screening_review']),
      }),
    ]

    const restore = stubRules(rules)
    const service = new ClinicalSuggestionService()
    const context: EncounterClinicalContext = {
      stage: 'screening_review',
      labItems: [labItem('Malaria RDT', { result_value: 'Positive' })],
    }

    const payload = await service.suggestForEncounter(new Encounter(), context)
    restore()

    assert.lengthOf(payload.fields.final_diagnosis ?? [], 1)
    assert.include(payload.fields.final_diagnosis![0].text, 'Uncomplicated malaria')
    assert.lengthOf(payload.prescriptions, 1)
    assert.equal(payload.prescriptions[0].items[0].drug_name, 'Artemether-Lumefantrine')
  })

  test('HIV reactive suggests referral diagnosis', async ({ assert }) => {
    const rules = [
      makeRule({
        id: 3,
        testName: 'HIV 1 & 2',
        matchKind: 'value_equals',
        matchValue: 'Reactive',
        targetField: 'final_diagnosis',
        suggestionText: 'HIV reactive — confirm with lab and counsel for referral to ART clinic.',
        stageScope: JSON.stringify(['screening_review']),
      }),
    ]

    const restore = stubRules(rules)
    const service = new ClinicalSuggestionService()
    const payload = await service.suggestForEncounter(new Encounter(), {
      stage: 'screening_review',
      labItems: [labItem('HIV RDT', { result_value: 'Reactive' })],
    })
    restore()

    assert.lengthOf(payload.fields.final_diagnosis ?? [], 1)
    assert.include(payload.fields.final_diagnosis![0].text, 'HIV reactive')
  })

  test('normal lab result yields no suggestions', async ({ assert }) => {
    const rules = [
      makeRule({
        id: 4,
        testName: 'MPS RDT',
        matchKind: 'value_equals',
        matchValue: 'Positive',
        targetField: 'final_diagnosis',
        suggestionText: 'Uncomplicated malaria',
      }),
    ]

    const restore = stubRules(rules)
    const service = new ClinicalSuggestionService()
    const payload = await service.suggestForEncounter(new Encounter(), {
      stage: 'screening_review',
      labItems: [labItem('MPS RDT', { result_value: 'Negative', interpretation: 'normal' })],
    })
    restore()

    assert.lengthOf(payload.fields.final_diagnosis ?? [], 0)
    assert.lengthOf(payload.prescriptions, 0)
  })

  test('fever vital trigger suggests provisional diagnosis at screening', async ({ assert }) => {
    const rules = [
      makeRule({
        id: 5,
        testName: null,
        matchKind: 'any_result',
        matchValue: null,
        targetField: 'provisional_diagnosis',
        suggestionText: 'Pyrexia of unknown origin — evaluate for malaria, URTI, and urinary tract infection.',
        triggerContext: 'vital',
        contextMatch: 'fever',
        stageScope: JSON.stringify(['screening', 'triage']),
      }),
    ]

    const restore = stubRules(rules)
    const service = new ClinicalSuggestionService()
    const payload = await service.suggestForEncounter(new Encounter(), {
      stage: 'screening',
      labItems: [],
      triage: { temperature: 38.5, systolic_bp: 120, diastolic_bp: 80, pulse: 88, oxygen_saturation: 98 },
    })
    restore()

    assert.lengthOf(payload.fields.provisional_diagnosis ?? [], 1)
    assert.include(payload.fields.provisional_diagnosis![0].text, 'Pyrexia')
  })
})

test.group('Clinical suggestion name normalization', () => {
  test('testNamesMatch resolves malaria RDT aliases', ({ assert }) => {
    assert.isTrue(testNamesMatch('MPS RDT', 'Malaria RDT'))
    assert.isTrue(testNamesMatch('MPS RDT', 'BLOOD SLIDE (MPS)'))
    assert.isFalse(testNamesMatch('MPS RDT', 'HIV 1 & 2'))
  })

  test('normalizeMatchValue is case-insensitive', ({ assert }) => {
    assert.equal(normalizeMatchValue('Positive'), 'positive')
    assert.equal(normalizeMatchValue('  Reactive '), 'reactive')
  })
})
