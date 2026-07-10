import vine from '@vinejs/vine'

const staffAssignment = vine.object({
  user_id: vine.number(),
  role_name: vine.string().trim().maxLength(60).optional().nullable(),
  participation_type: vine.string().trim().maxLength(60).optional().nullable(),
  notes: vine.string().trim().maxLength(500).optional().nullable(),
})

/**
 * Screening assessment validator. Mirrors App\Http\Requests\ScreeningRequest.
 */
export const screeningAssessmentValidator = vine.compile(
  vine.object({
    // Complaints & Histories
    complaints: vine.string().trim().maxLength(3000).optional().nullable(),
    tb_symptoms: vine.array(vine.string().trim().maxLength(100)).optional().nullable(),
    constitutional_symptoms: vine.string().trim().maxLength(255).optional().nullable(),
    presumptive_tb_case_no: vine.string().trim().maxLength(100).optional().nullable(),
    review_of_systems: vine.string().trim().maxLength(5000).optional().nullable(),
    history_of_presenting_illness: vine.string().trim().maxLength(5000).optional().nullable(),
    past_medical_history: vine.string().trim().maxLength(5000).optional().nullable(),
    medication_history: vine.string().trim().maxLength(3000).optional().nullable(),
    allergy_history: vine.string().trim().maxLength(3000).optional().nullable(),
    chronic_conditions: vine.string().trim().maxLength(3000).optional().nullable(),
    family_history: vine.string().trim().maxLength(3000).optional().nullable(),
    social_history: vine.string().trim().maxLength(3000).optional().nullable(),

    // Paediatric History
    birth_weight: vine.number().min(0.1).max(15).optional().nullable(),
    birth_length: vine.number().min(1).max(100).optional().nullable(),
    head_circumference: vine.number().min(1).max(100).optional().nullable(),
    chest_circumference: vine.number().min(1).max(100).optional().nullable(),
    general_condition: vine.string().trim().maxLength(100).optional().nullable(),
    is_breast_feeding_well: vine.boolean().optional().nullable(),
    other_feeding_option: vine.string().trim().maxLength(100).optional().nullable(),
    delivery_time: vine.string().trim().maxLength(20).optional().nullable(),
    vaccination_outside: vine.string().trim().maxLength(255).optional().nullable(),
    tetanus_at_birth: vine.string().trim().maxLength(100).optional().nullable(),
    birth_outcome: vine.string().trim().maxLength(100).optional().nullable(),
    birth_notes: vine.string().trim().maxLength(3000).optional().nullable(),
    immunization_history: vine.string().trim().maxLength(5000).optional().nullable(),
    feeding_code: vine.string().trim().maxLength(150).optional().nullable(),
    feeding_comments: vine.string().trim().maxLength(3000).optional().nullable(),
    development_history: vine.string().trim().maxLength(5000).optional().nullable(),

    // Examination & Diagnosis
    physical_examination: vine.string().trim().maxLength(5000).optional().nullable(),
    clinical_findings: vine.string().trim().maxLength(5000).optional().nullable(),
    provisional_diagnosis: vine.string().trim().maxLength(2000).optional().nullable(),
    final_diagnosis: vine.string().trim().maxLength(2000).optional().nullable(),
    assessment_notes: vine.string().trim().maxLength(3000).optional().nullable(),

    // Plan
    plan: vine.string().trim().maxLength(3000).optional().nullable(),
    treatment_plan: vine.string().trim().maxLength(3000).optional().nullable(),
    lab_requested: vine.boolean().optional(),
    prescriptions: vine.string().optional().nullable(),
    lab_items: vine.string().optional().nullable(),
    lab_priority_level: vine.string().trim().maxLength(20).optional().nullable(),
    lab_request_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),

    // Staff assignments
    staff_assignments: vine.array(staffAssignment).optional().nullable(),

    // Gyn & OBS — Menstrual History
    menstrual_cycle_regularity: vine
      .enum(['regular', 'irregular', 'absent'])
      .optional()
      .nullable(),
    cycle_length_days: vine.number().min(1).max(60).optional().nullable(),
    duration_of_flow_days: vine.number().min(1).max(30).optional().nullable(),
    last_menstrual_period: vine.date().optional().nullable(),
    dysmenorrhoea: vine.boolean().optional().nullable(),
    intermenstrual_bleeding: vine.boolean().optional().nullable(),
    post_coital_bleeding: vine.boolean().optional().nullable(),
    menstrual_notes: vine.string().trim().maxLength(1000).optional().nullable(),

    // Gyn & OBS — Obstetrics History
    gravida: vine.number().min(0).max(20).optional().nullable(),
    para: vine.number().min(0).max(20).optional().nullable(),
    abortus: vine.number().min(0).max(20).optional().nullable(),
    living_children: vine.number().min(0).max(20).optional().nullable(),
    currently_pregnant: vine.boolean().optional().nullable(),
    expected_delivery_date: vine.date().optional().nullable(),
    previous_obstetric_complications: vine.string().trim().maxLength(2000).optional().nullable(),
    obstetrics_notes: vine.string().trim().maxLength(1000).optional().nullable(),

    // Gyn & OBS — Contraceptive History
    using_contraception: vine.boolean().optional().nullable(),
    contraceptive_method: vine
      .enum([
        'none',
        'oral_pill',
        'injectable',
        'implant',
        'iud',
        'condom_male',
        'condom_female',
        'natural',
        'sterilisation',
        'other',
      ])
      .optional()
      .nullable(),
    contraceptive_method_other: vine.string().trim().maxLength(100).optional().nullable(),
    contraceptive_duration_months: vine.number().min(0).max(600).optional().nullable(),
    previous_contraceptive_methods: vine.string().trim().maxLength(2000).optional().nullable(),
    contraceptive_notes: vine.string().trim().maxLength(1000).optional().nullable(),

    // Gyn & OBS — Cervical Cancer History
    cervical_screening_done: vine.boolean().optional().nullable(),
    cervical_screening_date: vine.date().optional().nullable(),
    cervical_screening_method: vine
      .enum(['via', 'vili', 'pap_smear', 'hpv_test', 'colposcopy', 'other'])
      .optional()
      .nullable(),
    cervical_screening_result: vine
      .enum([
        'normal',
        'abnormal_low_grade',
        'abnormal_high_grade',
        'suspicious_cancer',
        'inconclusive',
      ])
      .optional()
      .nullable(),
    cervical_screening_result_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    cervical_treatment_done: vine.boolean().optional().nullable(),
    cervical_treatment_type: vine.string().trim().maxLength(100).optional().nullable(),
    cervical_cancer_notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)

const labItem = vine.object({
  test_name: vine.string().trim().maxLength(255),
  test_code: vine.string().trim().maxLength(100).optional().nullable(),
  specimen_type: vine.string().trim().maxLength(255).optional().nullable(),
  lab_specimen_type_id: vine.number().optional().nullable(),
  test_group: vine.string().trim().maxLength(255).optional().nullable(),
  instructions: vine.string().trim().maxLength(1000).optional().nullable(),
})

export const clinicianLabRequestValidator = vine.compile(
  vine.object({
    priority_level: vine.enum(['normal', 'urgent', 'stat']),
    request_notes: vine.string().trim().maxLength(2000).optional().nullable(),
    notes: vine.string().trim().maxLength(2000).optional().nullable(),
    items: vine.array(labItem).minLength(1),
  })
)

export const vitalRecheckValidator = vine.compile(
  vine.object({
    weight: vine.number().min(0).max(500).optional().nullable(),
    height: vine.number().min(0).max(300).optional().nullable(),
    bp_systolic: vine.number().min(40).max(300).optional().nullable(),
    bp_diastolic: vine.number().min(20).max(200).optional().nullable(),
    pulse: vine.number().min(20).max(250).optional().nullable(),
    temperature: vine.number().min(30).max(45).optional().nullable(),
    spo2: vine.number().min(0).max(100).optional().nullable(),
    notes: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

export const vitalRecheckAutosaveValidator = vine.compile(
  vine.object({
    id: vine.number().optional().nullable(),
    weight: vine.number().min(0).max(500).optional().nullable(),
    height: vine.number().min(0).max(300).optional().nullable(),
    bp_systolic: vine.number().min(40).max(300).optional().nullable(),
    bp_diastolic: vine.number().min(20).max(200).optional().nullable(),
    pulse: vine.number().min(20).max(250).optional().nullable(),
    temperature: vine.number().min(30).max(45).optional().nullable(),
    spo2: vine.number().min(0).max(100).optional().nullable(),
    notes: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)
