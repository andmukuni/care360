import vine from '@vinejs/vine'

const interpretation = vine.enum(['normal', 'abnormal', 'critical', 'inconclusive'])

export const labSamplesValidator = vine.compile(
  vine.object({
    items: vine
      .array(
        vine.object({
          test_name: vine.string().trim().maxLength(255),
          test_code: vine.string().trim().maxLength(100).optional().nullable(),
          specimen_type: vine.string().trim().maxLength(255).optional().nullable(),
          lab_specimen_type_id: vine.number().optional().nullable(),
          test_group: vine.string().trim().maxLength(255).optional().nullable(),
          instructions: vine.string().trim().maxLength(1000).optional().nullable(),
        })
      )
      .optional(),
    samples: vine
      .array(
        vine.object({
          sample_type: vine.string().trim().maxLength(255).optional().nullable(),
          lab_specimen_type_id: vine.number().optional().nullable(),
          sample_label: vine.string().trim().maxLength(255).optional().nullable(),
          collection_notes: vine.string().trim().maxLength(1000).optional().nullable(),
        })
      )
      .optional(),
  })
)

export const labResultsValidator = vine.compile(
  vine.object({
    results: vine
      .array(
        vine.object({
          lab_request_item_id: vine.number().optional().nullable(),
          result_value: vine.string().trim().maxLength(200).optional().nullable(),
          result_text: vine.string().trim().maxLength(2000).optional().nullable(),
          reference_range: vine.string().trim().maxLength(200).optional().nullable(),
          interpretation: interpretation.optional().nullable(),
          remarks: vine.string().trim().maxLength(1000).optional().nullable(),
        })
      )
      .minLength(1),
  })
)

export const labResultUpdateValidator = vine.compile(
  vine.object({
    result_value: vine.string().trim().maxLength(200).optional().nullable(),
    result_text: vine.string().trim().maxLength(2000).optional().nullable(),
    reference_range: vine.string().trim().maxLength(200).optional().nullable(),
    interpretation: interpretation.optional().nullable(),
    remarks: vine.string().trim().maxLength(1000).optional().nullable(),
    active_tab: vine.enum(['requests', 'results']).optional().nullable(),
  })
)

export const labResultMetaValidator = vine.compile(
  vine.object({
    reference_range: vine.string().trim().maxLength(200).optional().nullable(),
    interpretation: interpretation.optional().nullable(),
    active_tab: vine.enum(['requests', 'results']).optional().nullable(),
  })
)

export const labCompleteValidator = vine.compile(
  vine.object({
    results: vine
      .array(
        vine.object({
          lab_request_item_id: vine.number().optional().nullable(),
          result_value: vine.string().trim().maxLength(200).optional().nullable(),
          result_text: vine.string().trim().maxLength(2000).optional().nullable(),
          reference_range: vine.string().trim().maxLength(200).optional().nullable(),
          interpretation: interpretation.optional().nullable(),
          remarks: vine.string().trim().maxLength(1000).optional().nullable(),
        })
      )
      .optional(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)
