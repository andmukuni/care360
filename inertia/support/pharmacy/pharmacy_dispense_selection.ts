export type PrescriptionItemRow = {
  id: number
  drug_name: string
  dose?: string | null
  formulation?: string | null
  item_per_dose?: number | null
  frequency?: string | null
  time_per?: string | null
  frequency_unit?: string | null
  duration?: string | null
  duration_unit?: string | null
  start_date?: string | null
  end_date?: string | null
  quantity_prescribed?: number | null
  route?: string | null
  is_passer_by?: boolean
  instructions?: string | null
}

export type PharmacyRecommendationRow = {
  id: number
  status: string
  note: string | null
  source_item_id: number
  recommended_item_id: number | null
  recommended_by?: string | null
  source: PrescriptionItemRow | null
  recommended: PrescriptionItemRow | null
}

export type PrescriptionDisplayGroup = {
  source: PrescriptionItemRow
  recommendation: PharmacyRecommendationRow | null
}

export type DispenseDraftItem = {
  pharmacy_prescription_item_id: number | null
  quantity_dispensed?: number | null
  selected_for_dispense?: boolean | null
}

/** Group prescription lines for paired original / recommended display. */
export function buildPrescriptionDisplayGroups(
  items: PrescriptionItemRow[],
  recommendations: PharmacyRecommendationRow[]
): PrescriptionDisplayGroup[] {
  const recommendationsBySourceId = new Map<number, PharmacyRecommendationRow>()
  for (const row of recommendations) {
    if (!recommendationsBySourceId.has(row.source_item_id)) {
      recommendationsBySourceId.set(row.source_item_id, row)
    }
  }

  const recommendedOnlyItemIds = new Set(
    recommendations
      .map((row) => row.recommended_item_id)
      .filter((id): id is number => id != null)
  )

  return items
    .filter((item) => !recommendedOnlyItemIds.has(item.id))
    .map((source) => ({
      source,
      recommendation: recommendationsBySourceId.get(source.id) ?? null,
    }))
}

/** Item ids pharmacists may select for dispensing (excludes superseded originals). */
export function dispensableItemIds(
  groups: PrescriptionDisplayGroup[],
  dispensedItemIds: Set<number> | number[]
): number[] {
  const dispensed = dispensedItemIds instanceof Set ? dispensedItemIds : new Set(dispensedItemIds)
  const ids: number[] = []

  for (const group of groups) {
    const recItem = group.recommendation?.recommended
    if (recItem && !dispensed.has(recItem.id)) {
      ids.push(recItem.id)
      continue
    }
    if (!group.recommendation && !dispensed.has(group.source.id)) {
      ids.push(group.source.id)
    }
  }

  return ids
}

/** Default checkbox state: all dispensable rows checked. */
export function defaultSelectedForDispense(
  dispensableIds: number[],
  draftItems: DispenseDraftItem[] | null | undefined
): Record<number, boolean> {
  const selected: Record<number, boolean> = {}
  const draftById = new Map<number, DispenseDraftItem>()
  for (const draft of draftItems ?? []) {
    if (draft.pharmacy_prescription_item_id != null) {
      draftById.set(draft.pharmacy_prescription_item_id, draft)
    }
  }

  for (const id of dispensableIds) {
    const draft = draftById.get(id)
    selected[id] = draft?.selected_for_dispense ?? true
  }

  return selected
}

export function filterSelectedDispenseItems<
  T extends { pharmacy_prescription_item_id: number; quantity_dispensed: number },
>(items: T[], selectedForDispense: Record<number, boolean>): T[] {
  return items.filter(
    (item) =>
      selectedForDispense[item.pharmacy_prescription_item_id] === true &&
      item.quantity_dispensed >= 1
  )
}
