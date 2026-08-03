import { test } from '@japa/runner'
import {
  buildPrescriptionDisplayGroups,
  defaultSelectedForDispense,
  dispensableItemIds,
  filterSelectedDispenseItems,
  type PharmacyRecommendationRow,
  type PrescriptionItemRow,
} from '../../inertia/support/pharmacy/pharmacy_dispense_selection.js'

const item = (id: number, drug: string): PrescriptionItemRow => ({
  id,
  drug_name: drug,
})

const recommendation = (
  sourceId: number,
  recommendedId: number
): PharmacyRecommendationRow => ({
  id: 1,
  status: 'accepted',
  note: null,
  source_item_id: sourceId,
  recommended_item_id: recommendedId,
  source: item(sourceId, 'Original'),
  recommended: item(recommendedId, 'Substitute'),
})

test.group('pharmacy_dispense_selection', () => {
  test('buildPrescriptionDisplayGroups pairs source with recommendation and hides standalone recommended row', ({
    assert,
  }) => {
    const items = [item(1, 'Paracetamol'), item(2, 'Amoxicillin')]
    const groups = buildPrescriptionDisplayGroups(items, [recommendation(1, 2)])

    assert.lengthOf(groups, 1)
    assert.equal(groups[0].source.id, 1)
    assert.equal(groups[0].recommendation?.recommended_item_id, 2)
  })

  test('dispensableItemIds returns recommended id when substitution exists', ({ assert }) => {
    const items = [item(1, 'Paracetamol'), item(2, 'Amoxicillin')]
    const groups = buildPrescriptionDisplayGroups(items, [recommendation(1, 2)])

    assert.deepEqual(dispensableItemIds(groups, []), [2])
  })

  test('dispensableItemIds returns source id when no recommendation', ({ assert }) => {
    const items = [item(1, 'Paracetamol'), item(3, 'Ibuprofen')]
    const groups = buildPrescriptionDisplayGroups(items, [])

    assert.deepEqual(dispensableItemIds(groups, []), [1, 3])
  })

  test('dispensableItemIds excludes dispensed items', ({ assert }) => {
    const items = [item(1, 'Paracetamol'), item(3, 'Ibuprofen')]
    const groups = buildPrescriptionDisplayGroups(items, [])

    assert.deepEqual(dispensableItemIds(groups, new Set([1])), [3])
  })

  test('defaultSelectedForDispense restores draft selection', ({ assert }) => {
    const selected = defaultSelectedForDispense([1, 2], [
      { pharmacy_prescription_item_id: 1, selected_for_dispense: false },
      { pharmacy_prescription_item_id: 2, selected_for_dispense: true },
    ])

    assert.isFalse(selected[1])
    assert.isTrue(selected[2])
  })

  test('filterSelectedDispenseItems keeps only checked rows with qty >= 1', ({ assert }) => {
    const filtered = filterSelectedDispenseItems(
      [
        { pharmacy_prescription_item_id: 1, quantity_dispensed: 2, drug_name: 'A' },
        { pharmacy_prescription_item_id: 2, quantity_dispensed: 1, drug_name: 'B' },
        { pharmacy_prescription_item_id: 3, quantity_dispensed: 0, drug_name: 'C' },
      ],
      { 1: true, 2: false, 3: true }
    )

    assert.lengthOf(filtered, 1)
    assert.equal(filtered[0].pharmacy_prescription_item_id, 1)
  })
})
