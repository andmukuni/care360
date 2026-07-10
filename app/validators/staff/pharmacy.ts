import vine from '@vinejs/vine'

const prescriptionItem = vine.object({
  drug_name: vine.string().trim().maxLength(255),
  strength: vine.string().trim().maxLength(100).optional().nullable(),
  formulation: vine.string().trim().maxLength(100).optional().nullable(),
  dose: vine.string().trim().maxLength(100).optional().nullable(),
  item_per_dose: vine.number().optional().nullable(),
  frequency: vine.string().trim().maxLength(100).optional().nullable(),
  frequency_unit: vine.string().trim().maxLength(50).optional().nullable(),
  duration: vine.string().trim().maxLength(100).optional().nullable(),
  duration_unit: vine.string().trim().maxLength(50).optional().nullable(),
  quantity_prescribed: vine.number().optional().nullable(),
  route: vine.string().trim().maxLength(100).optional().nullable(),
  instructions: vine.string().trim().maxLength(1000).optional().nullable(),
})

export const pharmacyPrescriptionValidator = vine.compile(
  vine.object({
    notes: vine.string().trim().maxLength(2000).optional().nullable(),
    items: vine.array(prescriptionItem).minLength(1),
  })
)

export const dispenseValidator = vine.compile(
  vine.object({
    dispensing_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    counseling_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    items: vine
      .array(
        vine.object({
          pharmacy_prescription_item_id: vine.number().optional().nullable(),
          medication_id: vine.number().optional().nullable(),
          drug_name: vine.string().trim().maxLength(255),
          quantity_dispensed: vine.number().min(0),
          batch_no: vine.string().trim().maxLength(100).optional().nullable(),
          stock_reference: vine.string().trim().maxLength(100).optional().nullable(),
          instructions: vine.string().trim().maxLength(1000).optional().nullable(),
        })
      )
      .minLength(1),
  })
)

export const closeEncounterValidator = vine.compile(
  vine.object({
    closure_notes: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

export const pharmacyDispenseDraftValidator = vine.compile(
  vine.object({
    dispensing_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    counseling_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    items: vine
      .array(
        vine.object({
          pharmacy_prescription_item_id: vine.number().optional().nullable(),
          drug_name: vine.string().trim().maxLength(255).optional().nullable(),
          quantity_dispensed: vine.number().min(0).optional().nullable(),
        })
      )
      .optional(),
  })
)
