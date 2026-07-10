import vine from '@vinejs/vine'

/**
 * Validators for the registration desk. Ported from StartEncounterRequest.
 *
 * NOTE (deferred): the Laravel request enforced DB `unique`/`exists` rules on
 * nrc_number/phone_number/household_id/village and config-driven visit_type /
 * priority_level enums. Those DB-backed rules are omitted here for the first
 * pass; the StartEncounterAction still guards deceased/inactive patients and
 * active-encounter duplication.
 */
export const startEncounterValidator = vine.compile(
  vine.object({
    patient_id: vine.number().optional().nullable(),
    full_name: vine.string().trim().maxLength(255).optional().nullable(),
    gender: vine.enum(['male', 'female', 'other']).optional().nullable(),
    date_of_birth: vine.string().trim().optional().nullable(),
    nrc_number: vine.string().trim().maxLength(30).optional().nullable(),
    phone_number: vine.string().trim().maxLength(30).optional().nullable(),
    email: vine.string().trim().email().maxLength(255).optional().nullable(),
    create_household: vine.boolean().optional(),
    household_id: vine.string().trim().optional().nullable(),
    village: vine.string().trim().maxLength(255).optional().nullable(),
    payment_plan: vine.enum(['monthly', 'annual']).optional().nullable(),
    payment_mode: vine.enum(['cash', 'mobile_money']).optional().nullable(),
    payment_amount: vine.number().optional().nullable(),
    visit_type: vine.string().trim().maxLength(50).optional().nullable(),
    priority_level: vine.string().trim().maxLength(50).optional().nullable(),
    search_reference: vine.string().trim().maxLength(255).optional().nullable(),
    registration_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    confirm_inactive_patient: vine.boolean().optional(),
  })
)
