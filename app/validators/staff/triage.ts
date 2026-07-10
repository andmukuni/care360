import vine from '@vinejs/vine'

/**
 * Triage vitals validator. Mirrors the fields consumed by RecordTriageAction.
 * All vitals are optional so a nurse can save partial vitals and revise later.
 */
export const triageVitalsValidator = vine.compile(
  vine.object({
    weight: vine.number().min(0.5).max(300).optional().nullable(),
    height: vine.number().min(30).max(250).optional().nullable(),
    temperature: vine.number().min(20).max(45).optional().nullable(),
    pulse: vine.number().min(0).max(300).optional().nullable(),
    respiratory_rate: vine.number().min(0).max(120).optional().nullable(),
    systolic_bp: vine.number().min(0).max(400).optional().nullable(),
    diastolic_bp: vine.number().min(0).max(300).optional().nullable(),
    oxygen_saturation: vine.number().min(0).max(100).optional().nullable(),
    blood_sugar: vine.number().min(0).max(100).optional().nullable(),
    pain_scale: vine.number().min(0).max(10).optional().nullable(),
    muac: vine.number().min(0).max(100).optional().nullable(),
    muac_score: vine.string().trim().maxLength(20).optional().nullable(),
    abdominal_circumference: vine.number().min(20).max(200).optional().nullable(),
    chief_complaint_brief: vine.string().trim().maxLength(500).optional().nullable(),
    startup_interventions_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    startup_medications_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    triage_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)

/**
 * Startup medication create/recommend validator (shared).
 */
export const startupMedicationValidator = vine.compile(
  vine.object({
    medication_id: vine.number().positive().optional().nullable(),
    medication_name: vine.string().trim().maxLength(255),
    dosage: vine.string().trim().maxLength(100).optional().nullable(),
    route: vine.string().trim().maxLength(50).optional().nullable(),
    frequency: vine.string().trim().maxLength(50).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
    administered_at: vine.string().trim().optional().nullable(),
  })
)
