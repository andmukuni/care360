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
  source_prescription_item_id: vine.number().optional().nullable(),
})

export const screeningReviewValidator = vine.compile(
  vine.object({
    final_diagnosis: vine.string().trim().maxLength(2000),
    clinical_findings: vine.string().trim().maxLength(5000).optional().nullable(),
    physical_examination: vine.string().trim().maxLength(5000).optional().nullable(),
    assessment_notes: vine.string().trim().maxLength(5000).optional().nullable(),
    plan: vine.string().trim().maxLength(5000).optional().nullable(),
    review_notes: vine.string().trim().maxLength(5000).optional().nullable(),
    prescription_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    items: vine.array(prescriptionItem).minLength(1),
  })
)

export const screeningReviewDraftValidator = vine.compile(
  vine.object({
    final_diagnosis: vine.string().trim().maxLength(2000).optional().nullable(),
    clinical_findings: vine.string().trim().maxLength(5000).optional().nullable(),
    physical_examination: vine.string().trim().maxLength(5000).optional().nullable(),
    assessment_notes: vine.string().trim().maxLength(5000).optional().nullable(),
    plan: vine.string().trim().maxLength(5000).optional().nullable(),
    review_notes: vine.string().trim().maxLength(5000).optional().nullable(),
    prescription_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    items: vine.array(prescriptionItem).optional(),
  })
)
