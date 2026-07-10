import vine from '@vinejs/vine'

export const possibleResultValidator = vine.compile(
  vine.object({
    test_name: vine.string().trim().maxLength(200).nullable().optional(),
    test_type_id: vine.number().nullable().optional(),
    match_kind: vine.enum(['interpretation', 'value_equals', 'value_contains', 'any_result']),
    match_value: vine.string().trim().maxLength(120).nullable().optional(),
    target_field: vine.string().trim().maxLength(60),
    suggestion_text: vine.string().trim().maxLength(5000).nullable().optional(),
    prescription_payload: vine.string().trim().nullable().optional(),
    stage_scope: vine.array(vine.string().trim()).minLength(1),
    trigger_context: vine.enum(['lab_result', 'symptom', 'vital', 'diagnosis_keyword']),
    context_match: vine.string().trim().maxLength(200).nullable().optional(),
    priority: vine.number().min(0).max(9999).optional(),
    is_active: vine.boolean().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)
